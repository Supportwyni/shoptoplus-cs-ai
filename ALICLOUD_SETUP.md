# Using Alibaba Cloud Model Studio with ShopToPlus AI

Alibaba Cloud Model Studio (DashScope) is an excellent choice for your AI customer service bot, especially for Chinese markets!

## 🎯 Why Alibaba Cloud?

- **Excellent Chinese Support** - Qwen models are optimized for Chinese
- **Cost-Effective** - Competitive pricing
- **Fast in Asia** - Low latency for Hong Kong/China customers
- **Multiple Models** - From fast (qwen-turbo) to powerful (qwen-max)
- **Compatible API** - Works with OpenAI SDK
- **Great for Business** - Enterprise-grade reliability

## 💰 Pricing

| Model | Price per 1M tokens | Best For |
|-------|-------------------|----------|
| **qwen-turbo** | ~¥2 RMB | Fast responses, simple queries |
| **qwen-plus** | ~¥8 RMB | Balanced performance (Recommended) |
| **qwen-max** | ~¥40 RMB | Complex reasoning, high quality |
| **qwen-max-longcontext** | ~¥40 RMB | Long conversations |

**Estimated Cost:** 1,000 conversations ≈ ¥1-5 RMB ($0.15-0.70 USD)

## 🚀 Setup Instructions

### Step 1: Get Alibaba Cloud Account

1. Go to **https://www.aliyun.com/** (Alibaba Cloud)
2. Sign up for an account
   - Use email, phone, or Alipay
   - Supports Chinese and English
3. Complete identity verification if required

### Step 2: Access Model Studio (DashScope)

1. Go to **https://dashscope.console.aliyun.com/**
2. Or search for "模型服务灵积" (Model Studio DashScope) in Alibaba Cloud console
3. Activate the service (usually free to activate)

### Step 3: Get Your API Key

1. In DashScope console, click **"API-KEY管理"** (API Key Management)
2. Or go to: https://dashscope.console.aliyun.com/apiKey
3. Click **"创建新的API-KEY"** (Create New API Key)
4. **Copy the API key** (starts with `sk-`)
5. ⚠️ **Save it securely** - you won't see it again!

### Step 4: Add Credits (if needed)

1. Go to **"费用中心"** (Billing Center)
2. Add credits via:
   - Alipay
   - Credit/Debit Card
   - Bank Transfer
3. Usually ¥50-100 RMB is enough to start

### Step 5: Configure Your Bot

Edit your `.env` file:

```env
# Supabase Configuration
SUPABASE_URL=https://wvwpujuwflpfqblwtcqf.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# AI Configuration - USE ALIBABA CLOUD
AI_PROVIDER=alicloud
ALICLOUD_API_KEY=sk-your-alibaba-cloud-api-key-here
AI_MODEL=qwen-plus

# Server Configuration
PORT=3000
NODE_ENV=development

# WhatsApp Configuration (optional)
WHATSAPP_API_URL=https://graph.facebook.com/v18.0
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_VERIFY_TOKEN=my_secure_verify_token_123
```

### Step 6: Start Your Bot

```bash
npm run dev
```

You should see:
```
╔═══════════════════════════════════════════════════════════╗
║   ShopToPlus AI Customer Service Bot                      ║
║   Server running on port 3000                             ║
╚═══════════════════════════════════════════════════════════╝
```

## 🤖 Available Models

### 1. **qwen-turbo** ⚡
- **Speed:** Very Fast (1-2 seconds)
- **Cost:** Lowest
- **Best for:** Simple queries, quick responses
- **Chinese:** Excellent

### 2. **qwen-plus** ⭐ (Recommended)
- **Speed:** Fast (2-3 seconds)
- **Cost:** Medium
- **Best for:** Most customer service scenarios
- **Chinese:** Excellent
- **Balanced performance and cost**

### 3. **qwen-max** 🚀
- **Speed:** Moderate (3-4 seconds)
- **Cost:** Higher
- **Best for:** Complex reasoning, detailed responses
- **Chinese:** Outstanding
- **Best quality**

### 4. **qwen-max-longcontext** 📚
- **Speed:** Moderate
- **Cost:** Higher
- **Best for:** Long conversation history
- **Context:** Up to 30K tokens
- **Great for complex orders**

## 🎯 Recommended Configuration

For your wholesale customer service bot:

```env
AI_MODEL=qwen-plus
```

**Why qwen-plus?**
- ✅ Fast enough for real-time chat
- ✅ High quality Chinese responses
- ✅ Cost-effective for high volume
- ✅ Handles product queries well
- ✅ Good at parsing orders

## 🌐 Language Support

Qwen models are **excellent for Chinese**:
- ✅ Traditional Chinese (繁體中文) - Perfect for Hong Kong
- ✅ Simplified Chinese (简体中文)
- ✅ Cantonese understanding
- ✅ Mixed Chinese-English
- ✅ Business terminology
- ✅ Product codes and numbers

## 🔄 Switching Between Providers

You can easily switch between Alibaba Cloud, DeepSeek, or OpenAI:

### Use Alibaba Cloud:
```env
AI_PROVIDER=alicloud
ALICLOUD_API_KEY=sk-your-key
AI_MODEL=qwen-plus
```

### Use DeepSeek:
```env
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=sk-your-key
AI_MODEL=deepseek-chat
```

### Use OpenAI:
```env
AI_PROVIDER=openai
OPENAI_API_KEY=sk-proj-your-key
AI_MODEL=gpt-3.5-turbo
```

## ⚡ Performance

**Response Times (Hong Kong):**
- qwen-turbo: 1-2 seconds
- qwen-plus: 2-3 seconds
- qwen-max: 3-4 seconds

**Quality for Customer Service:**
```
                    Alibaba     DeepSeek    OpenAI
                    qwen-plus   V3          GPT-3.5
Chinese Support     ⭐⭐⭐⭐⭐      ⭐⭐⭐⭐⭐      ⭐⭐⭐
Hong Kong Context   ⭐⭐⭐⭐⭐      ⭐⭐⭐⭐       ⭐⭐⭐
Cost (HK market)    ⭐⭐⭐⭐       ⭐⭐⭐⭐⭐      ⭐⭐⭐
Speed (Asia)        ⭐⭐⭐⭐⭐      ⭐⭐⭐⭐       ⭐⭐⭐
Overall Value       ⭐⭐⭐⭐⭐      ⭐⭐⭐⭐⭐      ⭐⭐⭐⭐
```

## 🆘 Troubleshooting

### "Invalid API key" Error
- Check if API key is correct (starts with `sk-`)
- Verify DashScope service is activated
- Make sure no spaces in the key

### "Insufficient Balance"
- Add credits in Alibaba Cloud billing center
- Check usage dashboard for current balance

### Slow Responses
- Try `qwen-turbo` for faster responses
- Check your internet connection to Alibaba Cloud
- Consider using Alibaba Cloud's Hong Kong region

### Poor Chinese Responses
- Make sure `AI_PROVIDER=alicloud`
- Use `qwen-plus` or `qwen-max` for better quality
- Update your system prompts in `src/services/aiService.ts`

## 📚 Resources

- DashScope Console: https://dashscope.console.aliyun.com/
- API Documentation: https://help.aliyun.com/document_detail/2400395.html
- Model Pricing: https://dashscope.console.aliyun.com/billing
- Qwen Model Info: https://tongyi.aliyun.com/qianwen

## 🎉 Success!

Once configured, your bot will:
- ✅ Respond in natural Hong Kong Cantonese/Chinese
- ✅ Handle product inquiries intelligently
- ✅ Parse orders accurately
- ✅ Cost-effectively serve many customers
- ✅ Run fast with low latency in Asia

Perfect for your Hong Kong wholesale business! 🚀



