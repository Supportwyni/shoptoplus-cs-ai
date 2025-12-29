import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

export class WhatsAppService {
  private apiUrl: string;
  private phoneNumberId: string;
  private accessToken: string;

  constructor() {
    this.apiUrl = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v18.0';
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
    this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN || '';
  }

  /**
   * Send text message to customer
   */
  async sendTextMessage(to: string, message: string): Promise<boolean> {
    if (!this.phoneNumberId || !this.accessToken) {
      console.warn('WhatsApp credentials not configured, skipping message send');
      return false;
    }

    try {
      const response = await axios.post(
        `${this.apiUrl}/${this.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: to,
          type: 'text',
          text: {
            preview_url: false,
            body: message,
          },
        },
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('WhatsApp message sent:', response.data);
      return true;
    } catch (error: any) {
      console.error('Failed to send WhatsApp message:', error.response?.data || error.message);
      return false;
    }
  }

  /**
   * Send template message
   */
  async sendTemplateMessage(
    to: string,
    templateName: string,
    languageCode: string = 'zh_HK',
    components?: any[]
  ): Promise<boolean> {
    if (!this.phoneNumberId || !this.accessToken) {
      console.warn('WhatsApp credentials not configured, skipping template send');
      return false;
    }

    try {
      const response = await axios.post(
        `${this.apiUrl}/${this.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: to,
          type: 'template',
          template: {
            name: templateName,
            language: {
              code: languageCode,
            },
            components: components || [],
          },
        },
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('WhatsApp template sent:', response.data);
      return true;
    } catch (error: any) {
      console.error('Failed to send WhatsApp template:', error.response?.data || error.message);
      return false;
    }
  }

  /**
   * Mark message as read
   */
  async markAsRead(messageId: string): Promise<boolean> {
    if (!this.phoneNumberId || !this.accessToken) {
      return false;
    }

    try {
      await axios.post(
        `${this.apiUrl}/${this.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          status: 'read',
          message_id: messageId,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return true;
    } catch (error: any) {
      console.error('Failed to mark message as read:', error.response?.data || error.message);
      return false;
    }
  }

  /**
   * Verify webhook signature (for security)
   */
  verifyWebhookSignature(signature: string, body: string): boolean {
    // Implement signature verification if needed
    // This requires WHATSAPP_APP_SECRET
    return true;
  }

  /**
   * Parse incoming webhook message
   */
  parseWebhookMessage(body: any): {
    phoneNumber: string;
    message: string;
    messageId: string;
    messageType: string;
    timestamp: string;
  } | null {
    try {
      const entry = body.entry?.[0];
      const change = entry?.changes?.[0];
      const value = change?.value;

      if (!value?.messages || value.messages.length === 0) {
        return null;
      }

      const message = value.messages[0];
      const phoneNumber = message.from;

      let messageContent = '';
      let messageType = message.type;

      switch (message.type) {
        case 'text':
          messageContent = message.text.body;
          break;
        case 'image':
          messageContent = message.image.caption || '[Image]';
          break;
        case 'audio':
          messageContent = '[Audio message]';
          break;
        case 'document':
          messageContent = message.document.filename || '[Document]';
          break;
        case 'video':
          messageContent = message.video.caption || '[Video]';
          break;
        default:
          messageContent = `[${message.type}]`;
      }

      return {
        phoneNumber,
        message: messageContent,
        messageId: message.id,
        messageType,
        timestamp: message.timestamp,
      };
    } catch (error) {
      console.error('Failed to parse webhook message:', error);
      return null;
    }
  }
}

export default new WhatsAppService();

