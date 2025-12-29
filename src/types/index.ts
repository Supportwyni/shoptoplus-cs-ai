// Database Types
export interface Customer {
  id: string;
  phone_number: string;
  name?: string;
  email?: string;
  created_at: string;
  updated_at: string;
  last_active: string;
  conversation_state: string;
  needs_human_support: boolean;
  is_online: boolean;
  metadata: Record<string, any>;
}

export interface Message {
  id: string;
  customer_id?: string;
  phone_number: string;
  message_content: string;
  message_type: 'text' | 'image' | 'audio' | 'document' | 'video';
  direction: 'incoming' | 'outgoing';
  sender_type: 'customer' | 'ai' | 'human';
  timestamp: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  ai_response_time?: number;
  human_agent_id?: string;
  metadata: Record<string, any>;
}

export interface Product {
  id: string;
  product_code: string;
  product_name_chinese: string;
  product_name_english?: string;
  size?: string;
  box_specification?: string;
  wholesale_price?: number;
  search_text: string;
  embedding?: number[];
  created_at: string;
  updated_at: string;
}

export interface ProductAlias {
  id: string;
  alias_name: string;
  product_code: string;
  product_name_display?: string;
  created_by?: string;
  usage_count: number;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

export interface AITrainingData {
  id: string;
  question: string;
  answer: string;
  category: string;
  source: 'manual' | 'conversation' | 'google_sheets';
  created_by?: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  usage_count: number;
  confidence_score?: number;
  training_run_id?: string;
  run_label?: string;
}

export interface Order {
  id: string;
  customer_phone_number: string;
  customer_name: string;
  order_number: string;
  status: 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
  store_name?: string;
  delivery_address?: string;
  products: Array<{
    product_code?: string;
    product_name?: string;
    quantity: number;
    price?: number;
  }>;
  total_amount?: number;
  currency: string;
  order_source: 'whatsapp' | 'web' | 'phone' | 'manual';
  ai_parsed: boolean;
  ai_confidence?: number;
  whatsapp_message_id?: string;
  session_id?: string;
  raw_input?: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ConversationSession {
  id: string;
  customer_id?: string;
  phone_number: string;
  session_start: string;
  session_end?: string;
  is_human_mode: boolean;
  human_agent_id?: string;
  conversation_summary?: string;
  total_messages: number;
  ai_messages: number;
  human_messages: number;
  resolution_status: 'ongoing' | 'resolved' | 'escalated' | 'abandoned';
  metadata: Record<string, any>;
}

// Service Types
export interface AIResponse {
  response: string;
  confidence: number;
  intent: string;
  requiresHuman: boolean;
  suggestedProducts?: Product[];
  metadata?: Record<string, any>;
}

export interface ProductSearchResult {
  products: Product[];
  confidence: number;
  searchMethod: 'exact' | 'semantic' | 'alias' | 'fuzzy';
}

export interface ConversationContext {
  customer: Customer;
  recentMessages: Message[];
  currentSession: ConversationSession;
  orderInProgress?: Partial<Order>;
}

