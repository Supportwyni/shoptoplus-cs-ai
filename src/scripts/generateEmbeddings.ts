/**
 * Script to generate embeddings for products
 * Run this after importing products to enable semantic search
 */

import aiService from '../services/aiService';
import { supabase } from '../config/supabase';

async function generateProductEmbeddings() {
  console.log('Starting product embedding generation...');

  try {
    // Get all products without embeddings
    const { data: products, error } = await supabase
      .from('products')
      .select('*')
      .is('embedding', null);

    if (error) {
      throw error;
    }

    if (!products || products.length === 0) {
      console.log('No products found without embeddings');
      return;
    }

    console.log(`Found ${products.length} products to process`);

    let processed = 0;
    let failed = 0;

    for (const product of products) {
      try {
        // Build search text from product information
        const searchText = [
          product.product_code,
          product.product_name_chinese,
          product.product_name_english,
          product.size,
          product.box_specification,
        ]
          .filter(Boolean)
          .join(' ');

        console.log(`Processing: ${product.product_code} - ${product.product_name_chinese}`);

        // Generate embedding
        const embedding = await aiService.generateEmbedding(searchText);

        if (embedding.length === 0) {
          console.error(`Failed to generate embedding for ${product.product_code}`);
          failed++;
          continue;
        }

        // Update product with embedding
        const { error: updateError } = await supabase
          .from('products')
          .update({
            embedding: embedding,
            search_text: searchText,
          })
          .eq('id', product.id);

        if (updateError) {
          console.error(`Failed to update ${product.product_code}:`, updateError);
          failed++;
        } else {
          processed++;
          console.log(`✓ Processed ${processed}/${products.length}`);
        }

        // Rate limiting - wait a bit between requests
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Error processing ${product.product_code}:`, error);
        failed++;
      }
    }

    console.log('\n=== Summary ===');
    console.log(`Total products: ${products.length}`);
    console.log(`Successfully processed: ${processed}`);
    console.log(`Failed: ${failed}`);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
generateProductEmbeddings()
  .then(() => {
    console.log('\nEmbedding generation complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });

