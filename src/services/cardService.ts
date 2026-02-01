import { supabase } from '../lib/supabase';
import type { Card } from '../types/card';
import { fileURLToPath } from 'url';

export const cardService = {
  /**
   * Fetch a single card by its ID (e.g., "OP01-001")
   */
  async getCardById(cardId: string): Promise<Card | null> {
    const { data, error } = await supabase
      .from('cards')
      .select('*')
      .eq('card_id', cardId)
      .single();

    if (error) {
      console.error(`Error fetching card ${cardId}:`, error.message);
      return null;
    }
    return data;
  },

  /**
   * Search cards with pagination and filters
   */
  async getCards(filters: {
    searchTerm?: string;
    colour?: string;
    set_id?: string;
    limit?: number;
    offset?: number;
  }) {
    let query = supabase.from('cards').select('*', { count: 'exact' });

    if (filters.searchTerm) {
      // ILIKE is case-insensitive search
      query = query.ilike('name', `%${filters.searchTerm}%`);
    }
    if (filters.colour) {
      query = query.eq('colour', filters.colour);
    }
    if (filters.set_id) {
      query = query.eq('set_id', filters.set_id);
    }

    // Pagination
    const limit = filters.limit || 20;
    const offset = filters.offset || 0;
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
        console.error("Error fetching cards:", error.message);
        throw error;
    }
    return { data: data as Card[], count };
  }
};

// ------------------------------------------------------------------
// TEST RUNNER (Only runs when executing this file directly)
// Command: npx tsx src/services/cardService.ts
// ------------------------------------------------------------------
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    (async () => {
        console.log("🧪 Testing Card Service...");
        
        // Test 1: Fetch Luffy
        console.log("\n1. Fetching OP01-001 (Luffy)...");
        const luffy = await cardService.getCardById('OP01-001');
        console.log(luffy ? `✅ Found: ${luffy.name}` : "❌ Not Found");

        // Test 2: Search for 'Zoro'
        console.log("\n2. Searching for 'Zoro'...");
        const search = await cardService.getCards({ searchTerm: 'Zoro', limit: 3 });
        console.log(`✅ Found ${search.count} matches. Top 3:`);
        search.data?.forEach(c => console.log(`   - ${c.card_id}: ${c.name} (${c.set_id})`));
        
    })();
}
