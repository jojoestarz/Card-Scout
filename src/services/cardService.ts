import type { Card } from "../types/card";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  "https://ynhdlnqtzbolovuaxcqx.supabase.co";
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY;

if (!SUPABASE_KEY) {
  console.warn("⚠️  Missing EXPO_PUBLIC_SUPABASE_KEY");
}

export const supabaseNode = createClient(SUPABASE_URL, SUPABASE_KEY as string, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export const cardService = {
  /**
   * Fetch a single card by its ID (e.g., "OP01-001")
   */
  async getCards(): Promise<Card[]> {
    const { data, error } = await supabaseNode
      .from("cards")
      .select("*")
      .limit(10);

    if (error) {
      console.error("Error fetching cards:", error.message);
      throw error;
    }

    return (data ?? []) as Card[];
  },
  /**
   * Search cards with pagination and filters
   */
  async SearchCards(filters: {
    searchTerm?: string;
    colour?: string;
    set_id?: string;
    limit?: number;
    offset?: number;
  }) {
    let query = supabaseNode.from("cards").select("*", { count: "exact" });

    if (filters.searchTerm) {
      // ILIKE is case-insensitive search
      query = query.ilike("name", `%${filters.searchTerm}%`);
    }
    if (filters.colour) {
      query = query.eq("colour", filters.colour);
    }
    if (filters.set_id) {
      query = query.eq("set_id", filters.set_id);
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
  },
};

// Test the service
(async () => {
  try {
    const cards = await cardService.getCards();
    console.log("✅ Fetched cards:", cards.length);
    console.log("First card:", cards[0]);
  } catch (err) {
    console.error("❌ Failed to fetch cards:", err);
  }
})();
