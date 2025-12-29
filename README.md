# ShopToPlus AI Customer Service Bot

An intelligent AI-powered customer service bot for WhatsApp that integrates with Supabase. The bot can handle product inquiries, search products, process orders, and seamlessly escalate to human agents when needed.

## Features

- 🤖 **AI-Powered Responses**: Uses OpenAI GPT-4 for intelligent conversation
- 🔍 **Smart Product Search**: Multiple search strategies including:
  - Exact matching by product code/name
  - Product aliases for common names
  - Semantic search using vector embeddings
  - Fuzzy text search as fallback
- 💬 **Conversation Management**: Tracks customer conversations and sessions
- 📊 **Knowledge Base**: Searchable Q&A database for common inquiries
- 🔄 **Human Escalation**: Automatically escalates complex issues to human agents
- 📱 **WhatsApp Integration**: Full WhatsApp Business API support
- 🗄️ **Supabase Backend**: Complete database integration with PostgreSQL

## Architecture

```
src/
├── config/          # Configuration files
│   ├── supabase.ts  # Supabase client setup
│   └── openai.ts    # OpenAI client setup
├── services/        # Business logic
│   ├── aiService.ts           # AI processing and intent detection
│   ├── productSearch.ts       # Product search with multiple strategies
│   ├── knowledgeBase.ts       # Knowledge base queries
│   ├── conversationManager.ts # Conversation state management
│   └── whatsappService.ts     # WhatsApp API integration
├── controllers/     # Request handlers
│   └── webhookController.ts   # WhatsApp webhook handling
├── routes/          # API routes
│   └── index.ts
├── types/           # TypeScript type definitions
│   └── index.ts
└── index.ts         # Application entry point
```

## Prerequisites

- Node.js 18+ and npm
- Supabase account and project
- OpenAI API key
- WhatsApp Business API access (optional for production)

## Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd shoptoplus-cs-ai
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**

Create a `.env` file in the root directory:

```bash
cp env.template .env
```

Edit `.env` with your credentials:

```env
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# OpenAI Configuration
OPENAI_API_KEY=sk-your-openai-api-key
OPENAI_MODEL=gpt-4-turbo-preview

# Server Configuration
PORT=3000
NODE_ENV=development

# WhatsApp Configuration (optional for testing)
WHATSAPP_API_URL=https://graph.facebook.com/v18.0
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_ACCESS_TOKEN=your_access_token
WHATSAPP_VERIFY_TOKEN=your_verify_token
```

## Database Setup

### Required Supabase Functions

For semantic search to work, you need to create this function in your Supabase SQL editor:

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Function to match products using vector similarity
CREATE OR REPLACE FUNCTION match_products(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  product_code varchar,
  product_name_chinese text,
  product_name_english text,
  size varchar,
  box_specification varchar,
  wholesale_price numeric,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.product_code,
    p.product_name_chinese,
    p.product_name_english,
    p.size,
    p.box_specification,
    p.wholesale_price,
    1 - (p.embedding <=> query_embedding) as similarity
  FROM products p
  WHERE 1 - (p.embedding <=> query_embedding) > match_threshold
  ORDER BY p.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

### Generating Product Embeddings

To enable semantic search, you need to generate embeddings for your products. You can create a script or use the AI service:

```typescript
import aiService from './src/services/aiService';
import { supabase } from './src/config/supabase';

async function generateProductEmbeddings() {
  const { data: products } = await supabase
    .from('products')
    .select('*')
    .is('embedding', null);

  for (const product of products || []) {
    const searchText = `${product.product_name_chinese} ${product.product_name_english || ''} ${product.product_code}`;
    const embedding = await aiService.generateEmbedding(searchText);
    
    await supabase
      .from('products')
      .update({ embedding })
      .eq('id', product.id);
  }
}
```

## Usage

### Development Mode

```bash
npm run dev
```

This starts the server with hot-reload using `tsx watch`.

### Production Build

```bash
npm run build
npm start
```

### Testing the Bot

1. **Health Check**
```bash
curl http://localhost:3000/api/health
```

2. **Send a Test Message**
```bash
curl -X POST http://localhost:3000/api/send-message \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+85212345678",
    "message": "你好，我想查詢產品"
  }'
```

3. **Get Conversation History**
```bash
curl http://localhost:3000/api/conversation/+85212345678
```

## WhatsApp Integration

### Setting Up WhatsApp Webhook

1. Go to your WhatsApp Business API dashboard
2. Configure webhook URL: `https://your-domain.com/api/webhook`
3. Set verify token (same as `WHATSAPP_VERIFY_TOKEN` in `.env`)
4. Subscribe to message events

### Webhook Verification

WhatsApp will send a GET request to verify your webhook:
```
GET /api/webhook?hub.mode=subscribe&hub.verify_token=your_token&hub.challenge=challenge_string
```

The bot will respond with the challenge string if the token matches.

## API Endpoints

### Public Endpoints

- `GET /` - Service information
- `GET /api/health` - Health check
- `GET /api/webhook` - WhatsApp webhook verification
- `POST /api/webhook` - WhatsApp message handler

### Admin/Testing Endpoints

- `GET /api/conversation/:phoneNumber` - Get conversation history
- `POST /api/send-message` - Send manual message (for testing)

## Features in Detail

### Product Search

The bot uses a multi-strategy approach to find products:

1. **Exact Match**: Searches product code and names
2. **Alias Search**: Uses product aliases for common names
3. **Semantic Search**: Vector similarity using OpenAI embeddings
4. **Fuzzy Search**: Full-text search as fallback

### Intent Detection

The AI automatically detects customer intent:
- Product inquiry
- Order placement
- Delivery inquiry
- Order status check
- Complaint/issue
- Human support request
- General inquiry

### Conversation Management

- Automatic customer creation and tracking
- Session management (24-hour windows)
- Message history for context
- Session protection to prevent duplicate processing

### Human Escalation

The bot automatically escalates to human agents when:
- Customer explicitly requests human support
- Customer expresses frustration or complaints
- AI confidence is low
- Complex issues are detected

## Database Schema

The bot uses the following main tables:

- `customers` - Customer profiles and states
- `messages` - All conversation messages
- `conversation_sessions` - Conversation session tracking
- `products` - Product catalog with embeddings
- `product_aliases` - Alternative product names
- `ai_training_data` - Knowledge base Q&A
- `orders` - Order records
- `webhook_logs` - Webhook event logging
- `session_protection` - Duplicate message prevention

## Monitoring and Logging

All webhook events are logged to the `webhook_logs` table:
- Message received
- Message processed
- Errors and failures
- Response times
- AI confidence scores

## Troubleshooting

### Bot not responding

1. Check environment variables are set correctly
2. Verify Supabase connection
3. Check OpenAI API key is valid
4. Review webhook logs in database

### Product search not working

1. Ensure products have `search_text` populated
2. For semantic search, generate embeddings
3. Check product aliases are active

### WhatsApp messages not sending

1. Verify WhatsApp credentials
2. Check phone number format (+country_code)
3. Ensure WhatsApp Business API is active

## Development

### Adding New Intents

Edit `src/services/aiService.ts` and add detection logic in `detectIntent()`.

### Adding New Knowledge

Insert into `ai_training_data` table:
```sql
INSERT INTO ai_training_data (question, answer, category, source)
VALUES ('如何訂購？', '您可以直接告訴我產品編號和數量...', 'ordering', 'manual');
```

### Customizing AI Behavior

Edit the system prompt in `src/services/aiService.ts` `buildSystemPrompt()` method.

## License

MIT

## Support

For issues and questions, please contact the development team.

