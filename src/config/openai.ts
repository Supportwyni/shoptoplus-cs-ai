import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const AI_PROVIDER = process.env.AI_PROVIDER || 'alicloud'; // 'openai', 'alicloud', or 'deepseek'

if (!process.env.OPENAI_API_KEY && !process.env.ALICLOUD_API_KEY && !process.env.DASHSCOPE_API_KEY && !process.env.DEEPSEEK_API_KEY) {
  throw new Error('Missing AI API key. Please set OPENAI_API_KEY, ALICLOUD_API_KEY, DASHSCOPE_API_KEY, or DEEPSEEK_API_KEY');
}

// Initialize AI client based on provider
export const openai = new OpenAI(
  AI_PROVIDER === 'alicloud'
    ? {
        apiKey: process.env.ALICLOUD_API_KEY || process.env.DASHSCOPE_API_KEY,
        baseURL: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1', // International version
      }
    : AI_PROVIDER === 'deepseek'
    ? {
        apiKey: process.env.DEEPSEEK_API_KEY,
        baseURL: 'https://api.deepseek.com',
      }
    : {
        apiKey: process.env.OPENAI_API_KEY,
      }
);

// Model selection based on provider
export const OPENAI_MODEL =
  process.env.AI_MODEL ||
  (AI_PROVIDER === 'alicloud'
    ? 'qwen-plus'
    : AI_PROVIDER === 'deepseek'
    ? 'deepseek-chat'
    : 'gpt-4-turbo-preview');

export const EMBEDDING_MODEL =
  AI_PROVIDER === 'alicloud'
    ? 'text-embedding-v3'
    : AI_PROVIDER === 'deepseek'
    ? 'deepseek-embedding'
    : 'text-embedding-3-small';

export default openai;

