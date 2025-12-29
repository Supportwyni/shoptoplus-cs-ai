# Setup Guide for ShopToPlus AI Customer Service Bot

This guide will walk you through setting up the AI customer service bot from scratch.

## Step 1: Supabase Setup

### 1.1 Get Supabase Credentials

1. Go to your Supabase project dashboard
2. Navigate to **Settings** → **API**
3. Copy the following:
   - Project URL (e.g., `https://xxxxx.supabase.co`)
   - `anon` `public` key
   - `service_role` `secret` key (keep this secure!)

### 1.2 Enable Required Extensions

Run this in your Supabase SQL Editor:

```sql
-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable vector extension for semantic search
CREATE EXTENSION IF NOT EXISTS vector;
```

### 1.3 Create Vector Search Function

Run this in your Supabase SQL Editor:

```sql
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
  search_text text,
  created_at timestamptz,
  updated_at timestamptz,
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
    p.search_text,
    p.created_at,
    p.updated_at,
    1 - (p.embedding <=> query_embedding) as similarity
  FROM products p
  WHERE p.embedding IS NOT NULL
    AND 1 - (p.embedding <=> query_embedding) > match_threshold
  ORDER BY p.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

## Step 2: OpenAI Setup

1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Navigate to **API Keys**
3. Create a new API key
4. Copy the key (it starts with `sk-`)

## Step 3: Project Setup

### 3.1 Install Dependencies

```bash
npm install
```

### 3.2 Configure Environment Variables

1. Copy the template:
```bash
cp env.template .env
```

2. Edit `.env` with your credentials:

```env
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# OpenAI Configuration
OPENAI_API_KEY=sk-your-openai-api-key-here
OPENAI_MODEL=gpt-4-turbo-preview

# Server Configuration
PORT=3000
NODE_ENV=development

# WhatsApp Configuration (leave empty for now if testing)
WHATSAPP_API_URL=https://graph.facebook.com/v18.0
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_VERIFY_TOKEN=my_secure_verify_token_123
```

## Step 4: Generate Product Embeddings

To enable semantic product search, generate embeddings for your products:

```bash
npm run build
node dist/scripts/generateEmbeddings.js
```

This will:
- Fetch all products from your database
- Generate OpenAI embeddings for each product
- Store embeddings in the database

**Note**: This may take a while depending on how many products you have.

## Step 5: Add Training Data (Optional)

Add some common Q&A to your knowledge base:

```sql
INSERT INTO ai_training_data (question, answer, category, source) VALUES
('如何訂購？', '您可以直接告訴我產品編號和數量，我會協助您下單。例如：「我要訂購 ABC123 2箱」', 'ordering', 'manual'),
('送貨需要多久？', '一般情況下，我們會在1-3個工作天內送貨。具體時間視乎地區和庫存情況。', 'delivery', 'manual'),
('如何付款？', '我們接受銀行轉帳、PayMe、FPS等付款方式。下單後會提供詳細付款資訊。', 'payment', 'manual'),
('可以退貨嗎？', '如產品有質量問題，請在收貨後7天內聯絡我們。我們會安排退換貨服務。', 'returns', 'manual');
```

## Step 6: Test the Bot

### 6.1 Start the Server

```bash
npm run dev
```

You should see:
```
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   ShopToPlus AI Customer Service Bot                      ║
║                                                           ║
║   Server running on port 3000                             ║
║   Environment: development                                ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
```

### 6.2 Test Health Check

```bash
curl http://localhost:3000/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "service": "ShopToPlus AI Customer Service"
}
```

### 6.3 Test Product Search

Create a test conversation:

```bash
curl -X POST http://localhost:3000/api/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "entry": [{
      "changes": [{
        "value": {
          "messages": [{
            "from": "85212345678",
            "id": "test123",
            "timestamp": "1234567890",
            "type": "text",
            "text": {
              "body": "你好，我想查詢產品"
            }
          }]
        }
      }]
    }]
  }'
```

### 6.4 Check Conversation History

```bash
curl http://localhost:3000/api/conversation/85212345678
```

## Step 7: WhatsApp Integration (Production)

### 7.1 Get WhatsApp Business API Access

1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Create a new app or use existing
3. Add WhatsApp product
4. Get your:
   - Phone Number ID
   - Access Token
   - Set up a verify token

### 7.2 Configure Webhook

1. In your WhatsApp Business dashboard, go to **Configuration**
2. Set webhook URL: `https://your-domain.com/api/webhook`
3. Set verify token (same as in `.env`)
4. Subscribe to `messages` events

### 7.3 Update Environment Variables

```env
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_ACCESS_TOKEN=your_access_token
WHATSAPP_VERIFY_TOKEN=your_verify_token
```

### 7.4 Deploy to Production

Deploy your app to a hosting service (e.g., Railway, Render, DigitalOcean):

```bash
npm run build
npm start
```

Make sure your server is accessible via HTTPS (required by WhatsApp).

## Step 8: Monitoring

### 8.1 Check Webhook Logs

Query your database:

```sql
SELECT * FROM webhook_logs 
ORDER BY created_at DESC 
LIMIT 10;
```

### 8.2 Monitor Conversations

```sql
SELECT 
  c.phone_number,
  c.name,
  c.conversation_state,
  cs.total_messages,
  cs.resolution_status
FROM customers c
LEFT JOIN conversation_sessions cs ON c.id = cs.customer_id
WHERE cs.session_start > NOW() - INTERVAL '24 hours'
ORDER BY cs.session_start DESC;
```

## Troubleshooting

### Issue: "Missing Supabase environment variables"

**Solution**: Make sure `.env` file exists and contains valid Supabase credentials.

### Issue: "Semantic search not working"

**Solution**: 
1. Ensure `vector` extension is enabled
2. Run the embedding generation script
3. Verify `match_products` function exists

### Issue: "OpenAI API error"

**Solution**:
1. Check API key is valid
2. Ensure you have credits in your OpenAI account
3. Verify the model name is correct

### Issue: "WhatsApp messages not sending"

**Solution**:
1. Verify WhatsApp credentials in `.env`
2. Check phone number format includes country code (e.g., `+852`)
3. Ensure your WhatsApp Business API is active

## Next Steps

1. **Customize AI Behavior**: Edit system prompts in `src/services/aiService.ts`
2. **Add More Training Data**: Insert Q&A into `ai_training_data` table
3. **Create Product Aliases**: Add common product names to `product_aliases`
4. **Set Up Monitoring**: Use Supabase dashboard or external monitoring tools
5. **Add Analytics**: Track conversation metrics and AI performance

## Support

If you encounter any issues, check:
1. Server logs for error messages
2. `webhook_logs` table for webhook errors
3. Supabase logs for database errors

For additional help, contact the development team.

