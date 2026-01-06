import { openai } from '../config/openai';
import { OPENAI_MODEL } from '../config/openai';
import { AIResponse, ConversationContext, Product } from '../types';
import productSearchService from './productSearch';
import knowledgeBaseService from './knowledgeBase';
import conversationManager from './conversationManager';

export class AIService {
  /**
   * Process customer message and generate AI response
   */
  async processMessage(
    message: string,
    context: ConversationContext
  ): Promise<AIResponse> {
    try {
      console.log('--- AI Service: Processing Message ---');
      
      // Detect language preference
      const preferredLanguage = this.detectLanguagePreference(message, context);
      
      // Remove language hint prefix if present
      let cleanMessage = message;
      if (message.startsWith('[EN] ') || message.startsWith('[ZH] ')) {
        cleanMessage = message.substring(5); // Remove "[XX] "
        console.log('Cleaned message:', cleanMessage);
      }
      
      // Save language preference if it changed
      if (context.customer.metadata?.language_preference !== preferredLanguage) {
        await conversationManager.updateLanguagePreference(
          context.customer.phone_number,
          preferredLanguage
        );
        console.log('Language preference updated to:', preferredLanguage);
      }
      
      context.preferredLanguage = preferredLanguage;
      console.log('Preferred language:', preferredLanguage);
      
      // Detect intent (use cleaned message)
      console.log('Detecting intent...');
      const intent = await this.detectIntent(cleanMessage);
      console.log('Intent detected:', intent);

      // Build conversation history
      console.log('Building conversation history...');
      const conversationHistory = this.buildConversationHistory(context);
      console.log('History messages:', conversationHistory.length);

      // Search for relevant products if needed
      let productContext = '';
      let suggestedProducts: Product[] = [];
      
      if (intent === 'product_inquiry' || intent === 'order') {
        console.log('Searching for products...');
        const searchResult = await productSearchService.searchProducts(cleanMessage);
        suggestedProducts = searchResult.products;
        console.log('Products found:', suggestedProducts.length);
        if (suggestedProducts.length > 0) {
          const productListHeader = preferredLanguage === 'en' 
            ? '\n\nRelevant products found:\n'
            : '\n\n找到的相關產品：\n';
          productContext = `${productListHeader}${productSearchService.formatProductsForChat(suggestedProducts, preferredLanguage)}`;
        }
      }

      // Search knowledge base
      console.log('Searching knowledge base...');
      const knowledgeContext = await knowledgeBaseService.buildContext(cleanMessage);
      console.log('Knowledge entries found:', knowledgeContext ? 'Yes' : 'No');

      // Build system prompt
      console.log('Building system prompt...');
      console.log('🌐 Using language for system prompt:', preferredLanguage);
      const systemPrompt = this.buildSystemPrompt(context, knowledgeContext, preferredLanguage);
      console.log('📝 System prompt preview:', systemPrompt.substring(0, 150));

      // Generate AI response
      console.log('Calling AI API...');
      console.log('Model:', OPENAI_MODEL);
      console.log('Base URL:', process.env.AI_PROVIDER === 'alicloud' ? 'Alibaba Cloud DashScope' : 'OpenAI');
      
      // Add explicit language instruction to user message
      const languageInstruction = preferredLanguage === 'en' 
        ? '[Please respond in English only]'
        : '[請只用繁體中文回答]';
      
      const userMessage = `${languageInstruction}\n\n${cleanMessage}${productContext}`;
      console.log('💬 Final user message:', userMessage.substring(0, 100));
      
      const completion = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          ...conversationHistory,
          { role: 'user', content: userMessage },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      });
      
      console.log('✓ AI API call successful');
      console.log('Tokens used:', completion.usage?.total_tokens);

      const defaultResponse = preferredLanguage === 'en' 
        ? 'Sorry, I am unable to respond at the moment. Please try again later.'
        : '抱歉，我現在無法回答。請稍後再試。';
      const responseText = completion.choices[0].message.content || defaultResponse;

      // Determine if human support is needed
      const requiresHuman = this.shouldEscalateToHuman(cleanMessage, responseText, context);

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
    } catch (error: any) {
      console.error('=== AI SERVICE ERROR ===');
      console.error('Error Type:', error.constructor.name);
      console.error('Error Message:', error.message);
      console.error('Error Code:', error.code);
      console.error('Error Status:', error.status);
      console.error('Error Response:', JSON.stringify(error.response?.data || 'No response data'));
      console.error('Full Error Object:', JSON.stringify(error, null, 2));
      console.error('Stack:', error.stack);
      console.error('========================');
      
      const errorMessage = context.preferredLanguage === 'en'
        ? 'Sorry, a system error occurred. Please try again later or contact customer service.'
        : '抱歉，系統出現錯誤。請稍後再試或聯絡客服人員。';
      
      return {
        response: errorMessage,
        confidence: 0,
        intent: 'error',
        requiresHuman: true,
      };
    }
  }

  /**
   * Detect language preference from message and context
   */
  private detectLanguagePreference(message: string, context: ConversationContext): 'zh' | 'en' {
    console.log('🔍 Detecting language for message:', message.substring(0, 50));
    
    // Check for language hint prefix from frontend
    if (message.startsWith('[EN]')) {
      console.log('✅ Detected [EN] prefix → English');
      return 'en';
    }
    if (message.startsWith('[ZH]')) {
      console.log('✅ Detected [ZH] prefix → Chinese');
      return 'zh';
    }
    
    // Check if user explicitly requested language change
    const lowerMessage = message.toLowerCase();
    if (lowerMessage.includes('english') || lowerMessage.includes('switch to english') || lowerMessage === 'en') {
      console.log('✅ User requested English');
      return 'en';
    }
    if (lowerMessage.includes('中文') || lowerMessage.includes('繁體') || lowerMessage === 'zh') {
      console.log('✅ User requested Chinese');
      return 'zh';
    }
    
    // Check stored preference in metadata
    if (context.customer.metadata?.language_preference) {
      console.log('✅ Using stored preference:', context.customer.metadata.language_preference);
      return context.customer.metadata.language_preference;
    }
    
    // Detect based on message content (English has more ASCII characters)
    const asciiChars = message.match(/[a-zA-Z]/g);
    const chineseChars = message.match(/[\u4e00-\u9fff]/g);
    
    if (asciiChars && chineseChars) {
      // If mostly English, prefer English
      if (asciiChars.length > chineseChars.length * 2) {
        console.log('✅ Content analysis → English');
        return 'en';
      }
    } else if (asciiChars && asciiChars.length > 5) {
      console.log('✅ Content analysis → English');
      return 'en';
    }
    
    // Default to Chinese
    console.log('✅ Default → Chinese');
    return 'zh';
  }

  /**
   * Detect user intent from message
   */
  private async detectIntent(message: string): Promise<string> {
    const lowerMessage = message.toLowerCase();

    // Product inquiry keywords (Chinese + English)
    if (
      lowerMessage.includes('產品') ||
      lowerMessage.includes('商品') ||
      lowerMessage.includes('價格') ||
      lowerMessage.includes('價錢') ||
      lowerMessage.includes('多少錢') ||
      lowerMessage.includes('有沒有') ||
      lowerMessage.includes('有無') ||
      lowerMessage.includes('product') ||
      lowerMessage.includes('item') ||
      lowerMessage.includes('price') ||
      lowerMessage.includes('how much') ||
      lowerMessage.includes('cost') ||
      lowerMessage.includes('do you have')
    ) {
      return 'product_inquiry';
    }

    // Order keywords (Chinese + English)
    if (
      lowerMessage.includes('訂購') ||
      lowerMessage.includes('下單') ||
      lowerMessage.includes('買') ||
      lowerMessage.includes('要') ||
      lowerMessage.includes('order') ||
      lowerMessage.includes('purchase') ||
      lowerMessage.includes('buy') ||
      lowerMessage.includes('want to order') ||
      /\d+\s*(箱|盒|個|件|box|boxes|unit|units|piece|pieces)/.test(lowerMessage)
    ) {
      return 'order';
    }

    // Delivery/shipping keywords (Chinese + English)
    if (
      lowerMessage.includes('送貨') ||
      lowerMessage.includes('運送') ||
      lowerMessage.includes('配送') ||
      lowerMessage.includes('幾時到') ||
      lowerMessage.includes('何時到') ||
      lowerMessage.includes('delivery') ||
      lowerMessage.includes('shipping') ||
      lowerMessage.includes('ship') ||
      lowerMessage.includes('when will') ||
      lowerMessage.includes('arrive')
    ) {
      return 'delivery_inquiry';
    }

    // Order status keywords (Chinese + English)
    if (
      lowerMessage.includes('訂單') ||
      lowerMessage.includes('狀態') ||
      lowerMessage.includes('進度') ||
      lowerMessage.includes('order status') ||
      lowerMessage.includes('track order') ||
      lowerMessage.includes('my order')
    ) {
      return 'order_status';
    }

    // Complaint/issue keywords (Chinese + English)
    if (
      lowerMessage.includes('投訴') ||
      lowerMessage.includes('問題') ||
      lowerMessage.includes('錯誤') ||
      lowerMessage.includes('不滿') ||
      lowerMessage.includes('complaint') ||
      lowerMessage.includes('problem') ||
      lowerMessage.includes('issue') ||
      lowerMessage.includes('wrong') ||
      lowerMessage.includes('error')
    ) {
      return 'complaint';
    }

    // Human support request (Chinese + English)
    if (
      lowerMessage.includes('客服') ||
      lowerMessage.includes('真人') ||
      lowerMessage.includes('人工') ||
      lowerMessage.includes('職員') ||
      lowerMessage.includes('customer service') ||
      lowerMessage.includes('speak to someone') ||
      lowerMessage.includes('human') ||
      lowerMessage.includes('agent') ||
      lowerMessage.includes('representative')
    ) {
      return 'human_support_request';
    }

    return 'general_inquiry';
  }

  /**
   * Build system prompt with context
   */
  private buildSystemPrompt(context: ConversationContext, knowledgeContext: string, language: 'zh' | 'en' = 'zh'): string {
    if (language === 'en') {
      return `You are ShopToPlus's AI customer service assistant, specialized in helping customers with product inquiries and order processing.

CRITICAL: YOU MUST RESPOND IN ENGLISH ONLY. DO NOT USE CHINESE CHARACTERS IN YOUR RESPONSE.

Company Information:
- We are a wholesale company that sells various products
- We provide WhatsApp ordering service
- Customers can inquire about products, place orders, and track their orders

Your Responsibilities:
1. Answer customer questions in a friendly and professional manner
2. Help customers search for products
3. Assist customers with placing orders
4. Provide order status information
5. For complex issues, suggest contacting human customer service

Current Customer Information:
- Phone Number: ${context.customer.phone_number}
- Name: ${context.customer.name || 'Not provided'}
- Conversation State: ${context.customer.conversation_state}

${knowledgeContext}

IMPORTANT GUIDELINES:
- ALWAYS respond in English language
- Use English words only, no Chinese characters
- Maintain a friendly and professional tone
- If you're uncertain about an answer, be honest and suggest contacting human customer service
- Provide clear and specific product information
- If the customer expresses dissatisfaction or encounters complex issues, suggest transferring to human customer service

REMEMBER: Your entire response must be in English.`;
    }
    
    return `你是ShopToPlus的AI客服助手，專門協助客戶查詢產品和處理訂單。

重要：你必須只用繁體中文回答，不要使用英文。

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
- 必須使用繁體中文回答
- 不要使用英文字母（除了產品編號等必要資訊）
- 保持友善和專業
- 如果不確定答案，誠實告知並建議聯絡真人客服
- 提供產品資訊時要清晰明確
- 如果客戶表達不滿或遇到複雜問題，建議轉接真人客服

記住：你的整個回答都必須是繁體中文。`;
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
      const { EMBEDDING_MODEL } = await import('../config/openai');
      const response = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
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

