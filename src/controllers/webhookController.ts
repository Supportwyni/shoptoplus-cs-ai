import { Request, Response } from 'express';
import conversationManager from '../services/conversationManager';
import aiService from '../services/aiService';
import whatsappService from '../services/whatsappService';
import { supabase } from '../config/supabase';

export class WebhookController {
  /**
   * Verify webhook (GET request from WhatsApp)
   */
  async verifyWebhook(req: Request, res: Response): Promise<void> {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'your_verify_token';

    if (mode === 'subscribe' && token === verifyToken) {
      console.log('Webhook verified successfully');
      res.status(200).send(challenge);
    } else {
      console.error('Webhook verification failed');
      res.sendStatus(403);
    }
  }

  /**
   * Handle incoming webhook (POST request from WhatsApp)
   */
  async handleWebhook(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();

    try {
      // Acknowledge receipt immediately
      res.sendStatus(200);

      // Parse incoming message
      const parsedMessage = whatsappService.parseWebhookMessage(req.body);

      if (!parsedMessage) {
        console.log('No valid message in webhook');
        return;
      }

      const { phoneNumber, message, messageId, messageType } = parsedMessage;

      console.log(`Received message from ${phoneNumber}: ${message}`);

      // Log webhook event
      await this.logWebhookEvent(phoneNumber, messageId, 'message_received', message);

      // Check session protection to prevent duplicate processing
      const isProtected = await conversationManager.checkSessionProtection(phoneNumber);
      if (isProtected) {
        console.log(`Session protected for ${phoneNumber}, skipping processing`);
        return;
      }

      // Create session protection
      await conversationManager.createSessionProtection(phoneNumber, messageId);

      try {
        console.log('=== PROCESSING MESSAGE ===');
        console.log('Phone:', phoneNumber);
        console.log('Message:', message);
        
        // Mark message as read
        await whatsappService.markAsRead(messageId);
        console.log('✓ Marked as read');

        // Get or create customer
        console.log('Getting/creating customer...');
        const customer = await conversationManager.getOrCreateCustomer(phoneNumber);
        console.log('✓ Customer:', customer.id);

        // Save incoming message
        console.log('Saving incoming message...');
        await conversationManager.saveIncomingMessage(
          customer,
          message,
          messageType as any
        );
        console.log('✓ Message saved');

        // Build conversation context
        console.log('Building conversation context...');
        const context = await conversationManager.buildContext(customer);
        console.log('✓ Context built');

        // Process message with AI
        console.log('Processing with AI...');
        console.log('AI Provider:', process.env.AI_PROVIDER);
        console.log('AI Model:', process.env.AI_MODEL);
        const aiResponse = await aiService.processMessage(message, context);
        console.log('✓ AI Response received');
        console.log('Response:', aiResponse.response.substring(0, 100) + '...');

        // Calculate response time
        const responseTime = Date.now() - startTime;

        // Save AI response
        await conversationManager.saveOutgoingMessage(
          customer,
          aiResponse.response,
          responseTime
        );

        // Send response via WhatsApp
        await whatsappService.sendTextMessage(phoneNumber, aiResponse.response);

        // Check if escalation to human is needed
        if (aiResponse.requiresHuman) {
          await conversationManager.escalateToHuman(
            phoneNumber,
            'AI determined human support is needed'
          );

          // Send escalation message
          await whatsappService.sendTextMessage(
            phoneNumber,
            '我已經為您轉接到真人客服，請稍候。'
          );
        }

        // Update customer state if needed
        if (aiResponse.intent) {
          await conversationManager.updateCustomerState(
            phoneNumber,
            aiResponse.intent,
            aiResponse.requiresHuman
          );
        }

        // Log successful processing
        await this.logWebhookEvent(
          phoneNumber,
          messageId,
          'message_processed',
          message,
          true,
          null,
          {
            intent: aiResponse.intent,
            confidence: aiResponse.confidence,
            response_time: responseTime,
          }
        );
      } finally {
        // Release session protection
        await conversationManager.releaseSessionProtection(phoneNumber);
      }
      } catch (error: any) {
      console.error('=== WEBHOOK PROCESSING ERROR ===');
      console.error('Error Type:', error.constructor.name);
      console.error('Error Message:', error.message);
      console.error('Error Code:', error.code);
      console.error('Error Status:', error.status);
      console.error('Full Error:', error);
      console.error('Stack Trace:', error.stack);
      console.error('================================');

      // Log error
      await this.logWebhookEvent(
        'unknown',
        'unknown',
        'error',
        '',
        false,
        error.message
      );
    }
  }

  /**
   * Log webhook event to database
   */
  private async logWebhookEvent(
    phoneNumber: string,
    messageId: string,
    eventType: string,
    messageContent: string,
    success: boolean = true,
    errorMessage?: string | null,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      await supabase.from('webhook_logs').insert({
        phone_number: phoneNumber,
        message_id: messageId,
        event_type: eventType,
        message_content: messageContent,
        success,
        error_message: errorMessage,
        metadata: metadata || {},
      });
    } catch (error) {
      console.error('Failed to log webhook event:', error);
    }
  }

  /**
   * Health check endpoint
   */
  async healthCheck(req: Request, res: Response): Promise<void> {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'ShopToPlus AI Customer Service',
    });
  }

  /**
   * Get conversation history (for admin/testing)
   */
  async getConversationHistory(req: Request, res: Response): Promise<void> {
    try {
      const { phoneNumber } = req.params;

      if (!phoneNumber) {
        res.status(400).json({ error: 'Phone number is required' });
        return;
      }

      const messages = await conversationManager.getRecentMessages(phoneNumber, 50);

      res.status(200).json({
        phoneNumber,
        messageCount: messages.length,
        messages,
      });
    } catch (error: any) {
      console.error('Get conversation history error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Manual message send (for testing)
   */
  async sendManualMessage(req: Request, res: Response): Promise<void> {
    try {
      const { phoneNumber, message } = req.body;

      if (!phoneNumber || !message) {
        res.status(400).json({ error: 'Phone number and message are required' });
        return;
      }

      const success = await whatsappService.sendTextMessage(phoneNumber, message);

      if (success) {
        res.status(200).json({ success: true, message: 'Message sent' });
      } else {
        res.status(500).json({ success: false, error: 'Failed to send message' });
      }
    } catch (error: any) {
      console.error('Send manual message error:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

export default new WebhookController();

