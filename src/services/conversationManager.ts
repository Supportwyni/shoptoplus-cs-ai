import { supabase, supabaseAdmin } from '../config/supabase';
import {
  Customer,
  Message,
  ConversationSession,
  ConversationContext,
} from '../types';

export class ConversationManager {
  /**
   * Get or create customer by phone number
   */
  async getOrCreateCustomer(phoneNumber: string, name?: string): Promise<Customer> {
    // Try to get existing customer
    const { data: existingCustomer, error: fetchError } = await supabase
      .from('customers')
      .select('*')
      .eq('phone_number', phoneNumber)
      .single();

    if (existingCustomer && !fetchError) {
      // Update last active
      await supabase
        .from('customers')
        .update({ last_active: new Date().toISOString() })
        .eq('id', existingCustomer.id);

      return existingCustomer;
    }

    // Create new customer
    const { data: newCustomer, error: createError } = await supabase
      .from('customers')
      .insert({
        phone_number: phoneNumber,
        name: name || null,
        conversation_state: 'greeting',
        needs_human_support: false,
        is_online: true,
        metadata: {},
      })
      .select()
      .single();

    if (createError || !newCustomer) {
      throw new Error(`Failed to create customer: ${createError?.message}`);
    }

    return newCustomer;
  }

  /**
   * Get or create active conversation session
   */
  async getOrCreateSession(customer: Customer): Promise<ConversationSession> {
    // Try to get active session (within last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: activeSession, error: fetchError } = await supabase
      .from('conversation_sessions')
      .select('*')
      .eq('phone_number', customer.phone_number)
      .eq('resolution_status', 'ongoing')
      .gte('session_start', oneDayAgo)
      .order('session_start', { ascending: false })
      .limit(1)
      .single();

    if (activeSession && !fetchError) {
      return activeSession;
    }

    // Create new session
    const { data: newSession, error: createError } = await supabase
      .from('conversation_sessions')
      .insert({
        customer_id: customer.id,
        phone_number: customer.phone_number,
        session_start: new Date().toISOString(),
        is_human_mode: false,
        total_messages: 0,
        ai_messages: 0,
        human_messages: 0,
        resolution_status: 'ongoing',
        metadata: {},
      })
      .select()
      .single();

    if (createError || !newSession) {
      throw new Error(`Failed to create session: ${createError?.message}`);
    }

    return newSession;
  }

  /**
   * Save incoming message
   */
  async saveIncomingMessage(
    customer: Customer,
    messageContent: string,
    messageType: 'text' | 'image' | 'audio' | 'document' | 'video' = 'text'
  ): Promise<Message> {
    const { data: message, error } = await supabase
      .from('messages')
      .insert({
        customer_id: customer.id,
        phone_number: customer.phone_number,
        message_content: messageContent,
        message_type: messageType,
        direction: 'incoming',
        sender_type: 'customer',
        status: 'delivered',
        metadata: {},
      })
      .select()
      .single();

    if (error || !message) {
      throw new Error(`Failed to save message: ${error?.message}`);
    }

    // Update session message count
    await this.incrementSessionMessageCount(customer.phone_number, 'customer');

    return message;
  }

  /**
   * Save outgoing AI message
   */
  async saveOutgoingMessage(
    customer: Customer,
    messageContent: string,
    responseTime?: number
  ): Promise<Message> {
    const { data: message, error } = await supabase
      .from('messages')
      .insert({
        customer_id: customer.id,
        phone_number: customer.phone_number,
        message_content: messageContent,
        message_type: 'text',
        direction: 'outgoing',
        sender_type: 'ai',
        status: 'sent',
        ai_response_time: responseTime,
        metadata: {},
      })
      .select()
      .single();

    if (error || !message) {
      throw new Error(`Failed to save outgoing message: ${error?.message}`);
    }

    // Update session message count
    await this.incrementSessionMessageCount(customer.phone_number, 'ai');

    return message;
  }

  /**
   * Get recent messages for context
   */
  async getRecentMessages(phoneNumber: string, limit: number = 10): Promise<Message[]> {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('phone_number', phoneNumber)
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Failed to get recent messages:', error);
      return [];
    }

    return (data || []).reverse(); // Return in chronological order
  }

  /**
   * Build conversation context
   */
  async buildContext(customer: Customer): Promise<ConversationContext> {
    const session = await this.getOrCreateSession(customer);
    const recentMessages = await this.getRecentMessages(customer.phone_number);

    return {
      customer,
      recentMessages,
      currentSession: session,
    };
  }

  /**
   * Update customer conversation state
   */
  async updateCustomerState(
    phoneNumber: string,
    state: string,
    needsHumanSupport?: boolean
  ): Promise<void> {
    const updateData: any = {
      conversation_state: state,
      updated_at: new Date().toISOString(),
    };

    if (needsHumanSupport !== undefined) {
      updateData.needs_human_support = needsHumanSupport;
    }

    const { error } = await supabase
      .from('customers')
      .update(updateData)
      .eq('phone_number', phoneNumber);

    if (error) {
      console.error('Failed to update customer state:', error);
    }
  }

  /**
   * Escalate session to human
   */
  async escalateToHuman(
    phoneNumber: string,
    reason: string
  ): Promise<void> {
    // Update customer
    await supabase
      .from('customers')
      .update({
        needs_human_support: true,
        conversation_state: 'awaiting_human',
        updated_at: new Date().toISOString(),
      })
      .eq('phone_number', phoneNumber);

    // Update active session
    await supabase
      .from('conversation_sessions')
      .update({
        is_human_mode: true,
        resolution_status: 'escalated',
        metadata: { escalation_reason: reason },
      })
      .eq('phone_number', phoneNumber)
      .eq('resolution_status', 'ongoing');
  }

  /**
   * End conversation session
   */
  async endSession(
    phoneNumber: string,
    resolutionStatus: 'resolved' | 'escalated' | 'abandoned' = 'resolved',
    summary?: string
  ): Promise<void> {
    const { error } = await supabase
      .from('conversation_sessions')
      .update({
        session_end: new Date().toISOString(),
        resolution_status: resolutionStatus,
        conversation_summary: summary,
      })
      .eq('phone_number', phoneNumber)
      .eq('resolution_status', 'ongoing');

    if (error) {
      console.error('Failed to end session:', error);
    }
  }

  /**
   * Increment session message count
   */
  private async incrementSessionMessageCount(
    phoneNumber: string,
    senderType: 'customer' | 'ai' | 'human'
  ): Promise<void> {
    const { data: session } = await supabase
      .from('conversation_sessions')
      .select('*')
      .eq('phone_number', phoneNumber)
      .eq('resolution_status', 'ongoing')
      .order('session_start', { ascending: false })
      .limit(1)
      .single();

    if (!session) return;

    const updates: any = {
      total_messages: (session.total_messages || 0) + 1,
    };

    if (senderType === 'customer') {
      updates.human_messages = (session.human_messages || 0) + 1;
    } else if (senderType === 'ai') {
      updates.ai_messages = (session.ai_messages || 0) + 1;
    }

    await supabase
      .from('conversation_sessions')
      .update(updates)
      .eq('id', session.id);
  }

  /**
   * Check if session is protected (to prevent duplicate processing)
   */
  async checkSessionProtection(phoneNumber: string): Promise<boolean> {
    const { data } = await supabase
      .from('session_protection')
      .select('*')
      .eq('phone_number', phoneNumber)
      .eq('is_locked', true)
      .single();

    if (!data) return false;

    // Check if lock has expired
    const now = Date.now();
    if (data.locked_until < now) {
      // Lock expired, remove it
      await supabase
        .from('session_protection')
        .update({ is_locked: false })
        .eq('phone_number', phoneNumber);
      return false;
    }

    return true;
  }

  /**
   * Create session protection lock
   */
  async createSessionProtection(
    phoneNumber: string,
    sessionId: string,
    lockDuration: number = 30000 // 30 seconds default
  ): Promise<void> {
    const now = Date.now();

    await supabaseAdmin
      .from('session_protection')
      .upsert({
        phone_number: phoneNumber,
        session_id: sessionId,
        start_time: now,
        last_activity: now,
        current_stage: 'processing',
        message_count: 1,
        is_locked: true,
        locked_until: now + lockDuration,
        reason: 'Message processing in progress',
      });
  }

  /**
   * Release session protection lock
   */
  async releaseSessionProtection(phoneNumber: string): Promise<void> {
    await supabase
      .from('session_protection')
      .update({ is_locked: false })
      .eq('phone_number', phoneNumber);
  }
}

export default new ConversationManager();

