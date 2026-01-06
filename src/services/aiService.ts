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
      let productSearchStatus = 'not_attempted';
      
      if (intent === 'product_inquiry' || intent === 'order') {
        console.log('Searching for products...');
        try {
          const searchResult = await productSearchService.searchProducts(cleanMessage);
          suggestedProducts = searchResult.products;
          console.log('Products found:', suggestedProducts.length);
          
          if (suggestedProducts.length > 0) {
            const productListHeader = preferredLanguage === 'en' 
              ? '\n\nRelevant products found:\n'
              : '\n\n找到的相關產品：\n';
            productContext = `${productListHeader}${productSearchService.formatProductsForChat(suggestedProducts, preferredLanguage)}`;
            productSearchStatus = 'found';
          } else {
            // No products found
            productSearchStatus = 'none_found';
            const noProductsMsg = preferredLanguage === 'en'
              ? '\n\n[IMPORTANT: Product search returned NO RESULTS. The customer is asking about products, but nothing matches their query. Be honest and tell them no matching products were found. Suggest they provide more details or browse the catalog.]'
              : '\n\n[重要：產品搜尋沒有結果。客戶查詢產品，但沒有找到匹配的項目。請誠實告知客戶沒有找到相關產品，建議提供更多細節或瀏覽目錄。]';
            productContext = noProductsMsg;
          }
        } catch (error) {
          // Product search system failed
          console.error('Product search failed:', error);
          productSearchStatus = 'search_failed';
          const searchFailedMsg = preferredLanguage === 'en'
            ? '\n\n[CRITICAL: Product search system is currently UNAVAILABLE. You CANNOT search for products right now. Tell the customer that the product search system is temporarily unavailable and suggest they contact human support or try again later.]'
            : '\n\n[重要：產品搜尋系統目前無法使用。你現在無法搜尋產品。請告知客戶產品搜尋系統暫時無法使用，建議聯絡客服人員或稍後再試。]';
          productContext = searchFailedMsg;
        }
      }

      // Search knowledge base
      console.log('Searching knowledge base...');
      const knowledgeContext = await knowledgeBaseService.buildContext(cleanMessage);
      console.log('Knowledge entries found:', knowledgeContext ? 'Yes' : 'No');

      // Build system prompt
      console.log('Building system prompt...');
      console.log('🌐 Using language for system prompt:', preferredLanguage);
      console.log('🔍 Product search status:', productSearchStatus);
      const systemPrompt = this.buildSystemPrompt(context, knowledgeContext, preferredLanguage);
      console.log('📝 System prompt preview:', systemPrompt.substring(0, 150));

      // Generate AI response
      console.log('Calling AI API...');
      console.log('Model:', OPENAI_MODEL);
      console.log('Base URL:', process.env.AI_PROVIDER === 'alicloud' ? 'Alibaba Cloud DashScope' : 'OpenAI');
      
      // Build user message with product context
      const userMessage = `${cleanMessage}${productContext}`;
      console.log('💬 User message:', cleanMessage);
      console.log('📦 Product context length:', productContext.length);
      
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
          productSearchStatus,
          productsFound: suggestedProducts.length,
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
      return `You're an AI assistant for ShopToPlus, a wholesale company. Chat naturally like a friendly human sales rep.

🎯 YOUR PERSONALITY:
- Warm, helpful, and genuine - not robotic
- Casual but professional (like texting a colleague)
- Use contractions (I'm, you're, we'll, can't)
- Be conversational, not formal
- Keep messages SHORT (2-3 sentences max)

💬 HOW TO TALK:
Good: "Hey! I'd love to help you order. What are you looking for?"
Bad: "Thank you for your inquiry. To proceed with your order, please provide the following information..."

Good: "I found a few options for you! Check these out:"
Bad: "I have successfully located the following products that match your search criteria:"

🚫 NEVER:
- Write long explanations or bullet lists unless asked
- Use phrases like "I apologize for any inconvenience" or "Thank you for your patience"
- Number things unless showing products
- Be overly formal or corporate

${knowledgeContext}

✅ IF PRODUCTS ARE SHOWN:
- Present them naturally
- Ask which one they want
- Keep it simple

⚠️ IF NO PRODUCTS FOUND:
- Say honestly: "Hmm, I couldn't find that. Can you describe it differently?"
- Don't apologize excessively
- Offer to help differently

❌ IF SEARCH IS BROKEN:
- Be direct: "Our product search is down right now. Want to contact support or check back shortly?"
- Don't make excuses

Customer: ${context.customer.name || 'there'}
Reply in ENGLISH only. Be human, not corporate. Keep it short.`;
    }
    
    return `你係ShopToPlus嘅AI助手，幫客人搵產品同落單。要好似真人咁傾偈，唔好太公式化。

🎯 你嘅性格：
- 親切、有禮、真誠 - 唔係機械人咁
- 輕鬆但專業（好似同朋友傾WhatsApp咁）
- 用口語化嘅廣東話／繁中
- 簡短有力（通常2-3句就夠）

💬 點樣傾：
好：「你好呀！想訂啲咩？我幫你睇下。」
唔好：「感謝閣下的查詢。為了處理您的訂單，請提供以下資料...」

好：「搵到幾款啱你嘅！睇下呢啲：」
唔好：「本人已成功為您搜尋到以下符合條件的產品...」

🚫 千祈唔好：
- 長篇大論或列一堆點
- 講「不便之處敬請原諒」、「感謝耐心等候」呢啲
- 太過正式或官腔
- 冇需要就編號

${knowledgeContext}

✅ 如果搵到產品：
- 自然咁介紹
- 問佢想要邊款
- 簡單直接

⚠️ 如果搵唔到產品：
- 直接講：「搵唔到呀，可唔可以講詳細啲？」
- 唔使道歉咁多次
- 提議用其他方法幫手

❌ 如果搜尋壞咗：
- 直接講：「產品搜尋家下用唔到，要唔要聯絡客服或遲啲再試？」
- 唔使搵藉口

客人：${context.customer.name || ''}
只用繁體中文。要似人，唔好太公式化。簡短啲。`;
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

