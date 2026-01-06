# Deploying ShopToPlus AI to Vercel

## Prerequisites
1. A [Vercel account](https://vercel.com/signup)
2. [Vercel CLI](https://vercel.com/cli) installed (optional but recommended)
3. Your environment variables ready

## Deployment Steps

### Option 1: Deploy via Vercel Dashboard (Easiest)

1. **Push your code to GitHub**
   ```bash
   git add .
   git commit -m "Prepare for Vercel deployment"
   git push origin main
   ```

2. **Go to [Vercel Dashboard](https://vercel.com/dashboard)**

3. **Click "Add New Project"**

4. **Import your GitHub repository**

5. **Configure your project:**
   - Framework Preset: `Other`
   - Build Command: `npm run vercel-build`
   - Output Directory: `dist`
   - Install Command: `npm install`

6. **Add Environment Variables** (click "Environment Variables"):
   ```
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   
   AI_PROVIDER=alicloud
   ALICLOUD_API_KEY=your_alicloud_api_key
   AI_MODEL=qwen-plus
   
   WHATSAPP_API_URL=https://graph.facebook.com/v18.0
   WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
   WHATSAPP_ACCESS_TOKEN=your_access_token
   WHATSAPP_VERIFY_TOKEN=your_verify_token
   
   NODE_ENV=production
   ```

7. **Click "Deploy"**

8. **Wait for deployment** (usually takes 1-2 minutes)

9. **Your app will be live at:** `https://your-project-name.vercel.app`

---

### Option 2: Deploy via Vercel CLI

1. **Install Vercel CLI** (if not already installed):
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Build your project first**:
   ```bash
   npm run build
   ```

4. **Deploy to Vercel**:
   ```bash
   vercel
   ```
   
   Follow the prompts:
   - Set up and deploy? **Y**
   - Which scope? Select your account
   - Link to existing project? **N** (first time) or **Y** (subsequent deploys)
   - What's your project's name? Enter a name
   - In which directory is your code located? `./`

5. **Add environment variables**:
   ```bash
   vercel env add SUPABASE_URL
   vercel env add SUPABASE_ANON_KEY
   vercel env add SUPABASE_SERVICE_ROLE_KEY
   vercel env add AI_PROVIDER
   vercel env add ALICLOUD_API_KEY
   vercel env add AI_MODEL
   vercel env add WHATSAPP_API_URL
   vercel env add WHATSAPP_PHONE_NUMBER_ID
   vercel env add WHATSAPP_ACCESS_TOKEN
   vercel env add WHATSAPP_VERIFY_TOKEN
   ```

6. **Deploy to production**:
   ```bash
   vercel --prod
   ```

---

## Post-Deployment Configuration

### 1. Update WhatsApp Webhook URL
Once deployed, update your WhatsApp Business API webhook URL to:
```
https://your-project-name.vercel.app/api/webhook
```

### 2. Test Your Deployment
- **Health Check**: `https://your-project-name.vercel.app/api/health`
- **Web Interface**: `https://your-project-name.vercel.app`

### 3. Configure Custom Domain (Optional)
1. Go to your project settings in Vercel
2. Click "Domains"
3. Add your custom domain
4. Update DNS records as instructed

---

## Environment Variables Required

| Variable | Description | Required |
|----------|-------------|----------|
| `SUPABASE_URL` | Your Supabase project URL | ✅ Yes |
| `SUPABASE_ANON_KEY` | Supabase anonymous key | ✅ Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | ✅ Yes |
| `AI_PROVIDER` | AI provider (alicloud/openai/deepseek) | ✅ Yes |
| `ALICLOUD_API_KEY` | Alibaba Cloud DashScope API key | ✅ Yes (if using Alibaba) |
| `OPENAI_API_KEY` | OpenAI API key | ⚠️ Optional (if using OpenAI) |
| `DEEPSEEK_API_KEY` | DeepSeek API key | ⚠️ Optional (if using DeepSeek) |
| `AI_MODEL` | AI model name | ✅ Yes |
| `WHATSAPP_API_URL` | WhatsApp API URL | ⚠️ Optional (for production) |
| `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp phone number ID | ⚠️ Optional (for production) |
| `WHATSAPP_ACCESS_TOKEN` | WhatsApp access token | ⚠️ Optional (for production) |
| `WHATSAPP_VERIFY_TOKEN` | WhatsApp verify token | ⚠️ Optional (for production) |
| `NODE_ENV` | Environment (production) | ✅ Yes |

---

## Troubleshooting

### Build Fails
- Check that all dependencies are in `dependencies` (not `devDependencies`)
- Ensure TypeScript compiles without errors: `npm run build`
- Check Vercel build logs for specific errors

### API Not Working
- Verify all environment variables are set correctly
- Check Vercel function logs in the dashboard
- Ensure your database (Supabase) is accessible from Vercel

### Static Files Not Loading
- Verify `public` folder is included in your repository
- Check the `vercel.json` configuration

### Database Connection Issues
- Ensure Supabase allows connections from Vercel
- Check if your Supabase project is paused (free tier)

---

## Continuous Deployment

Once set up, every push to your main branch will automatically deploy to Vercel:

```bash
git add .
git commit -m "Update feature"
git push origin main
```

Vercel will:
1. Detect the push
2. Build your project
3. Deploy automatically
4. Update your live URL

---

## Monitoring

- **View Logs**: Vercel Dashboard → Your Project → Logs
- **Analytics**: Vercel Dashboard → Your Project → Analytics
- **Error Tracking**: Check function logs for errors

---

## Important Notes

⚠️ **Vercel Serverless Function Limits:**
- Execution timeout: 10 seconds (Hobby), 60 seconds (Pro)
- Max request size: 4.5 MB
- Memory: 1024 MB (Hobby), configurable (Pro)

⚠️ **For heavy AI processing**, consider:
- Upgrading to Vercel Pro for longer timeouts
- Using background jobs for long operations
- Implementing response streaming

---

## Support

- Vercel Docs: https://vercel.com/docs
- Vercel Community: https://github.com/vercel/vercel/discussions
- Project Issues: Contact your development team

---

## Quick Commands Reference

```bash
# Deploy to preview
vercel

# Deploy to production
vercel --prod

# View logs
vercel logs

# List deployments
vercel ls

# Remove deployment
vercel rm [deployment-url]

# Pull environment variables
vercel env pull
```

