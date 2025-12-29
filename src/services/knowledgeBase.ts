import { supabase } from '../config/supabase';
import { openai } from '../config/openai';
import { AITrainingData } from '../types';

export class KnowledgeBaseService {
  /**
   * Search knowledge base for relevant answers
   */
  async searchKnowledge(query: string, category?: string): Promise<AITrainingData[]> {
    try {
      // Generate embedding for the query
      const embeddingResponse = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: query,
      });

      const queryEmbedding = embeddingResponse.data[0].embedding;

      // Build query
      let supabaseQuery = supabase
        .from('ai_training_data')
        .select('*')
        .eq('is_active', true);

      if (category) {
        supabaseQuery = supabaseQuery.eq('category', category);
      }

      // Try semantic search first if available
      // For now, use text search as fallback
      const { data, error } = await supabaseQuery
        .or(`question.ilike.%${query}%,answer.ilike.%${query}%`)
        .order('confidence_score', { ascending: false, nullsFirst: false })
        .limit(5);

      if (error) {
        console.error('Knowledge base search error:', error);
        return [];
      }

      // Update usage count for matched entries
      if (data && data.length > 0) {
        for (const entry of data) {
          await supabase
            .from('ai_training_data')
            .update({ usage_count: (entry.usage_count || 0) + 1 })
            .eq('id', entry.id);
        }
      }

      return data || [];
    } catch (error) {
      console.error('Knowledge base search failed:', error);
      return [];
    }
  }

  /**
   * Get all active training data by category
   */
  async getByCategory(category: string): Promise<AITrainingData[]> {
    const { data, error } = await supabase
      .from('ai_training_data')
      .select('*')
      .eq('category', category)
      .eq('is_active', true)
      .order('confidence_score', { ascending: false, nullsFirst: false });

    if (error) {
      console.error('Get by category error:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Get all categories
   */
  async getCategories(): Promise<string[]> {
    const { data, error } = await supabase
      .from('ai_training_data')
      .select('category')
      .eq('is_active', true);

    if (error) {
      console.error('Get categories error:', error);
      return [];
    }

    const categories = [...new Set(data?.map(d => d.category) || [])];
    return categories;
  }

  /**
   * Add new training data
   */
  async addTrainingData(data: Partial<AITrainingData>): Promise<AITrainingData | null> {
    const { data: result, error } = await supabase
      .from('ai_training_data')
      .insert({
        question: data.question,
        answer: data.answer,
        category: data.category,
        source: data.source || 'manual',
        created_by: data.created_by,
        is_active: true,
        usage_count: 0,
      })
      .select()
      .single();

    if (error) {
      console.error('Add training data error:', error);
      return null;
    }

    return result;
  }

  /**
   * Build context from knowledge base for AI
   */
  async buildContext(query: string, category?: string): Promise<string> {
    const knowledgeEntries = await this.searchKnowledge(query, category);
    
    if (knowledgeEntries.length === 0) {
      return '';
    }

    let context = '相關知識庫資訊：\n\n';
    knowledgeEntries.forEach((entry, index) => {
      context += `${index + 1}. Q: ${entry.question}\n`;
      context += `   A: ${entry.answer}\n\n`;
    });

    return context;
  }
}

export default new KnowledgeBaseService();

