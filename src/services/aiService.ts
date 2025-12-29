import { openai } from '../config/openai';
import { OPENAI_MODEL } from '../config/openai';
import { AIResponse, ConversationContext, Product } from '../types';
import productSearchService from './productSearch';
import knowledgeBaseService from './knowledgeBase';

export class AIService {
  /**
   * Process customer message and generate AI response
   */
  async processMessage(
    message: string,
    context: ConversationContext
  ): Promise<AIResponse> {
    try {
      // Detect intent
      const intent = await this.detectIntent(message);

      // Build conversation history
      const conversationHistory = this.buildConversationHistory(context);

      // Search for relevant products if needed
      let productContext = '';
      let suggestedProducts: Product[] = [];
      
      if (intent === 'product_inquiry' || intent === 'order') {
        const searchResult = await productSearchService.searchProducts(message);
        suggestedProducts = searchResult.products;
        if (suggestedProducts.length > 0) {
          productContext = `\n\n找到的相關產品：\n${productSearchService.formatProductsForChat(suggestedProducts)}`;
        }
      }

      // Search knowledge base
      const knowledgeContext = await knowledgeBaseService.buildContext(message);

      // Build system prompt
      const systemPrompt = this.buildSystemPrompt(context, knowledgeContext);

      // Generate AI response
      const completion = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          ...conversationHistory,
          { role: 'user', content: message + productContext },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      });

      const responseText = completion.choices[0].message.content || '抱歉，我現在無法回答。請稍後再試。';

      // Determine if human support is needed
      const requiresHuman = this.shouldEscalateToHuman(message, responseText, context);

      // Calculate confidence
      const confidence = this.calculateConfidence(intent, suggestedProducts.length, knowledgeContext);

      return {
        response: responseText,
        confidence,
        intent,
        requiresHuman,
        suggestedProducts: suggestedProducts.length > 0 ? suggestedProducts : undefined,
        metadata: {
          model: OPENAI_MODEL,
          tokens: completion.usage?.total_tokens,
        },
      };
    } catch (error) {
      console.error('AI processing error:', error);
      return {
        response: '抱歉，系統出現錯誤。請稍後再試或聯絡客服人員。',
        confidence: 0,
        intent: 'error',
        requiresHuman: true,
      };
    }
  }

  /**
   * Detect user intent from message
   */
  private async detectIntent(message: string): Promise<string> {
    const lowerMessage = message.toLowerCase();

    // Product inquiry keywords
    if (
      lowerMessage.includes('產品') ||
      lowerMessage.includes('商品') ||
      lowerMessage.includes('價格') ||
      lowerMessage.includes('價錢') ||
      lowerMessage.includes('多少錢') ||
      lowerMessage.includes('有沒有') ||
      lowerMessage.includes('有無')
    ) {
      return 'product_inquiry';
    }

    // Order keywords
    if (
      lowerMessage.includes('訂購') ||
      lowerMessage.includes('下單') ||
      lowerMessage.includes('買') ||
      lowerMessage.includes('要') ||
      /\d+\s*(箱|盒|個|件)/.test(lowerMessage)
    ) {
      return 'order';
    }

    // Delivery/shipping keywords
    if (
      lowerMessage.includes('送貨') ||
      lowerMessage.includes('運送') ||
      lowerMessage.includes('配送') ||
      lowerMessage.includes('幾時到') ||
      lowerMessage.includes('何時到')
    ) {
      return 'delivery_inquiry';
    }

    // Order status keywords
    if (
      lowerMessage.includes('訂單') ||
      lowerMessage.includes('狀態') ||
      lowerMessage.includes('進度')
    ) {
      return 'order_status';
    }

    // Complaint/issue keywords
    if (
      lowerMessage.includes('投訴') ||
      lowerMessage.includes('問題') ||
      lowerMessage.includes('錯誤') ||
      lowerMessage.includes('不滿')
    ) {
      return 'complaint';
    }

    // Human support request
    if (
      lowerMessage.includes('客服') ||
      lowerMessage.includes('真人') ||
      lowerMessage.includes('人工') ||
      lowerMessage.includes('職員')
    ) {
      return 'human_support_request';
    }

    return 'general_inquiry';
  }

  /**
   * Build system prompt with context
   */
  private buildSystemPrompt(context: ConversationContext, knowledgeContext: string): string {
    return `你是ShopToPlus的AI客服助手，專門協助客戶查詢產品和處理訂單。

公司資訊：
- 我們是一家批發公司，主要銷售各類產品
- 我們提供WhatsApp訂購服務
- 客戶可以查詢產品、下單、追蹤訂單

你的職責：
1. 友善、專業地回答客戶問題
2. 協助客戶搜尋產品
3. 協助客戶下單
4. 提供訂單狀態資訊
5. 如遇複雜問題，建議客戶聯絡真人客服

當前客戶資訊：
- 電話號碼: ${context.customer.phone_number}
- 姓名: ${context.customer.name || '未提供'}
- 對話狀態: ${context.customer.conversation_state}

${knowledgeContext}

回答時請注意：
- 使用繁體中文
- 保持友善和專業
- 如果不確定答案，誠實告知並建議聯絡真人客服
- 提供產品資訊時要清晰明確
- 如果客戶表達不滿或遇到複雜問題，建議轉接真人客服`;
  }

  /**
   * Build conversation history for context
   */
  private buildConversationHistory(context: ConversationContext): Array<{ role: 'user' | 'assistant'; content: string }> {
    const history: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    // Get last 10 messages for context
    const recentMessages = context.recentMessages.slice(-10);

    for (const msg of recentMessages) {
      if (msg.sender_type === 'customer') {
        history.push({ role: 'user', content: msg.message_content });
      } else if (msg.sender_type === 'ai') {
        history.push({ role: 'assistant', content: msg.message_content });
      }
    }

    return history;
  }

  /**
   * Determine if conversation should be escalated to human
   */
  private shouldEscalateToHuman(
    userMessage: string,
    aiResponse: string,
    context: ConversationContext
  ): boolean {
    // Check if customer explicitly requests human support
    if (
      userMessage.includes('客服') ||
      userMessage.includes('真人') ||
      userMessage.includes('人工')
    ) {
      return true;
    }

    // Check if customer is expressing frustration
    if (
      userMessage.includes('投訴') ||
      userMessage.includes('不滿') ||
      userMessage.includes('差勁')
    ) {
      return true;
    }

    // Check if customer needs human support flag is set
    if (context.customer.needs_human_support) {
      return true;
    }

    // Check if AI response indicates uncertainty
    if (
      aiResponse.includes('不確定') ||
      aiResponse.includes('無法回答') ||
      aiResponse.includes('聯絡客服')
    ) {
      return true;
    }

    return false;
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(
    intent: string,
    productsFound: number,
    knowledgeContext: string
  ): number {
    let confidence = 0.5;

    // Boost confidence based on intent clarity
    if (intent !== 'general_inquiry' && intent !== 'error') {
      confidence += 0.2;
    }

    // Boost confidence if products were found
    if (productsFound > 0) {
      confidence += 0.2;
    }

    // Boost confidence if knowledge base had relevant info
    if (knowledgeContext.length > 0) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Generate embeddings for text (useful for semantic search)
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error('Embedding generation error:', error);
      return [];
    }
  }
}

export default new AIService();

