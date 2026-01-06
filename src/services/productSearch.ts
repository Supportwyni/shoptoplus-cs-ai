import { supabase } from '../config/supabase';
import { openai } from '../config/openai';
import { Product, ProductSearchResult } from '../types';

export class ProductSearchService {
  /**
   * Search for products using multiple strategies
   */
  async searchProducts(query: string, limit: number = 10): Promise<ProductSearchResult> {
    console.log(`🔎 Searching for: "${query}"`);
    
    // Try exact match first (most reliable)
    const exactMatch = await this.exactSearch(query, limit);
    if (exactMatch.products.length > 0) {
      console.log(`✅ Found ${exactMatch.products.length} products via exact match`);
      return exactMatch;
    }

    // Try alias search
    const aliasMatch = await this.aliasSearch(query, limit);
    if (aliasMatch.products.length > 0) {
      console.log(`✅ Found ${aliasMatch.products.length} products via alias search`);
      return aliasMatch;
    }

    // Try semantic search with embeddings (if available)
    try {
      const semanticMatch = await this.semanticSearch(query, limit);
      if (semanticMatch.products.length > 0) {
        console.log(`✅ Found ${semanticMatch.products.length} products via semantic search`);
        return semanticMatch;
      }
    } catch (error) {
      console.log('⚠️ Semantic search unavailable, continuing with fallback');
    }

    // Try fuzzy text search
    const fuzzyMatch = await this.fuzzySearch(query, limit);
    if (fuzzyMatch.products.length > 0) {
      console.log(`✅ Found ${fuzzyMatch.products.length} products via fuzzy search`);
      return fuzzyMatch;
    }
    
    // Last resort: get recent/popular products
    console.log('⚠️ No products found with search, trying to get sample products');
    const sampleProducts = await this.getSampleProducts(limit);
    
    if (sampleProducts.products.length > 0) {
      console.log(`✅ Showing ${sampleProducts.products.length} sample products instead`);
      return {
        ...sampleProducts,
        confidence: 0.3, // Low confidence since not matching query
      };
    }

    console.log('❌ No products found at all');
    return { products: [], confidence: 0, searchMethod: 'none' };
  }

  /**
   * Exact match by product code or name
   */
  private async exactSearch(query: string, limit: number): Promise<ProductSearchResult> {
    try {
      const searchTerm = `%${query}%`;
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .or(`product_code.ilike.${searchTerm},product_name_chinese.ilike.${searchTerm},product_name_english.ilike.${searchTerm}`)
        .limit(limit);

      if (error) {
        console.error('Exact search error:', error);
        return { products: [], confidence: 0, searchMethod: 'exact' };
      }

      return {
        products: data || [],
        confidence: data && data.length > 0 ? 0.95 : 0,
        searchMethod: 'exact',
      };
    } catch (error) {
      console.error('Exact search exception:', error);
      return { products: [], confidence: 0, searchMethod: 'exact' };
    }
  }

  /**
   * Search using product aliases
   */
  private async aliasSearch(query: string, limit: number): Promise<ProductSearchResult> {
    // Find matching aliases
    const { data: aliases, error: aliasError } = await supabase
      .from('product_aliases')
      .select('product_code, product_name_display')
      .ilike('alias_name', `%${query}%`)
      .eq('is_active', true);

    if (aliasError || !aliases || aliases.length === 0) {
      return { products: [], confidence: 0, searchMethod: 'alias' };
    }

    // Get products by codes
    const productCodes = aliases.map(a => a.product_code);
    const { data: products, error: productError } = await supabase
      .from('products')
      .select('*')
      .in('product_code', productCodes)
      .limit(limit);

    if (productError) {
      console.error('Alias product search error:', productError);
      return { products: [], confidence: 0, searchMethod: 'alias' };
    }

    // Update usage count for matched aliases
    for (const alias of aliases) {
      await supabase
        .from('product_aliases')
        .update({ usage_count: supabase.rpc('increment', { row_id: alias.product_code }) })
        .eq('product_code', alias.product_code);
    }

    return {
      products: products || [],
      confidence: 0.85,
      searchMethod: 'alias',
    };
  }

  /**
   * Semantic search using vector embeddings
   */
  private async semanticSearch(query: string, limit: number): Promise<ProductSearchResult> {
    try {
      // Generate embedding for the query
      const { EMBEDDING_MODEL } = await import('../config/openai');
      const embeddingResponse = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: query,
      });

      const queryEmbedding = embeddingResponse.data[0].embedding;

      // Search using vector similarity (requires pgvector extension)
      // Note: This uses RPC function that should be created in Supabase
      const { data, error } = await supabase.rpc('match_products', {
        query_embedding: queryEmbedding,
        match_threshold: 0.7,
        match_count: limit,
      });

      if (error) {
        console.error('Semantic search error:', error);
        return { products: [], confidence: 0, searchMethod: 'semantic' };
      }

      return {
        products: data || [],
        confidence: data && data.length > 0 ? 0.8 : 0,
        searchMethod: 'semantic',
      };
    } catch (error) {
      console.error('Semantic search failed:', error);
      return { products: [], confidence: 0, searchMethod: 'semantic' };
    }
  }

  /**
   * Fuzzy text search as fallback
   */
  private async fuzzySearch(query: string, limit: number): Promise<ProductSearchResult> {
    try {
      // Try text search first if search_text column exists
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .textSearch('search_text', query, {
          type: 'websearch',
          config: 'simple',
        })
        .limit(limit);

      if (!error && data && data.length > 0) {
        return {
          products: data,
          confidence: 0.6,
          searchMethod: 'fuzzy',
        };
      }

      // If text search fails or returns nothing, try broader LIKE search
      const searchTerm = `%${query}%`;
      const { data: likeData, error: likeError } = await supabase
        .from('products')
        .select('*')
        .ilike('search_text', searchTerm)
        .limit(limit);

      if (likeError) {
        console.error('Fuzzy search error:', likeError);
        return { products: [], confidence: 0, searchMethod: 'fuzzy' };
      }

      return {
        products: likeData || [],
        confidence: likeData && likeData.length > 0 ? 0.5 : 0,
        searchMethod: 'fuzzy',
      };
    } catch (error) {
      console.error('Fuzzy search exception:', error);
      return { products: [], confidence: 0, searchMethod: 'fuzzy' };
    }
  }

  /**
   * Get sample products when search returns nothing
   */
  private async getSampleProducts(limit: number): Promise<ProductSearchResult> {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .limit(limit);

      if (error) {
        console.error('Sample products error:', error);
        return { products: [], confidence: 0, searchMethod: 'sample' };
      }

      return {
        products: data || [],
        confidence: 0.2,
        searchMethod: 'sample',
      };
    } catch (error) {
      console.error('Sample products exception:', error);
      return { products: [], confidence: 0, searchMethod: 'sample' };
    }
  }

  /**
   * Get product by exact code
   */
  async getProductByCode(productCode: string): Promise<Product | null> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('product_code', productCode)
      .single();

    if (error) {
      console.error('Get product by code error:', error);
      return null;
    }

    return data;
  }

  /**
   * Get multiple products by codes
   */
  async getProductsByCodes(productCodes: string[]): Promise<Product[]> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .in('product_code', productCodes);

    if (error) {
      console.error('Get products by codes error:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Format products for display in chat
   */
  formatProductsForChat(products: Product[], language: 'zh' | 'en' = 'zh'): string {
    if (products.length === 0) {
      return language === 'en' 
        ? 'Sorry, I could not find any related products. Please provide more information or contact our customer service.'
        : '抱歉，我找不到相關的產品。請提供更多資訊或聯絡我們的客服人員。';
    }

    let message = language === 'en' 
      ? `I found the following products:\n\n`
      : `我找到了以下產品：\n\n`;
    
    products.forEach((product, index) => {
      if (language === 'en') {
        message += `${index + 1}. **${product.product_name_english || product.product_name_chinese}**\n`;
        if (product.product_name_chinese && product.product_name_english) {
          message += `   ${product.product_name_chinese}\n`;
        }
        message += `   Product Code: ${product.product_code}\n`;
        if (product.size) {
          message += `   Size: ${product.size}\n`;
        }
        if (product.box_specification) {
          message += `   Box Spec: ${product.box_specification}\n`;
        }
        if (product.wholesale_price) {
          message += `   Wholesale Price: HKD $${product.wholesale_price}\n`;
        }
      } else {
        message += `${index + 1}. **${product.product_name_chinese}**\n`;
        if (product.product_name_english) {
          message += `   ${product.product_name_english}\n`;
        }
        message += `   產品編號: ${product.product_code}\n`;
        if (product.size) {
          message += `   規格: ${product.size}\n`;
        }
        if (product.box_specification) {
          message += `   箱規: ${product.box_specification}\n`;
        }
        if (product.wholesale_price) {
          message += `   批發價: HKD $${product.wholesale_price}\n`;
        }
      }
      message += `\n`;
    });

    message += language === 'en'
      ? `To place an order or learn more, please tell me the product code and quantity.`
      : `如需訂購或了解更多資訊，請告訴我產品編號和數量。`;
    
    return message;
  }
}

export default new ProductSearchService();

