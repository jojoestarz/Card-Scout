import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Card } from "../types/card";

const SUPABASE_URL = "https://ynhdlnqtzbolovuaxcqx.supabase.co";
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || SUPABASE_URL;

// Lazy initialization - only create client when first accessed
let _supabase: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (!_supabase) {
    // Try service key first (bypasses RLS), fall back to public key
    const supabaseKey =
      process.env.SUPABASE_SERVICE_KEY ||
      process.env.EXPO_PUBLIC_SUPABASE_KEY ||
      "";

    if (!supabaseKey) {
      console.warn(
        "⚠️  Missing SUPABASE_SERVICE_KEY or EXPO_PUBLIC_SUPABASE_KEY",
      );
      throw new Error("supabaseKey is required.");
    }

    console.log(
      "[getSupabaseClient] Using key type:",
      process.env.SUPABASE_SERVICE_KEY ? "SERVICE" : "PUBLIC",
    );
    _supabase = createClient(supabaseUrl, supabaseKey);
  }

  return _supabase;
}

interface SearchCardsParams {
  searchTerm?: string;
  colour?: string;
  card_id?: string;
  limit?: number;
  offset?: number;
}

export const cardService = {
  async SearchCards({
    searchTerm = "",
    colour,
    card_id,
    limit = 20,
    offset = 0,
  }: SearchCardsParams = {}) {
    try {
      console.log("[cardService.SearchCards] Query:", {
        searchTerm,
        colour,
        card_id,
        limit,
        offset,
      });

      const supabase = getSupabaseClient(); // Get client lazily
      let query = supabase.from("cards").select("*");

      // Apply filters
      if (searchTerm) {
        console.log("[SearchCards] Applying searchTerm filter:", searchTerm);
        query = query.ilike("name", `%${searchTerm}%`);
      }

      if (colour) {
        console.log("[SearchCards] Applying colour filter:", colour);
        query = query.eq("colour", colour);
      }

      if (card_id) {
        console.log("[SearchCards] Applying card_id filter:", card_id);
        query = query.eq("card_id", card_id);
      }

      // Apply pagination
      console.log(
        "[SearchCards] Applying pagination - offset:",
        offset,
        "limit:",
        limit,
      );
      query = query.range(offset, offset + limit - 1);

      const { data, error } = await query;

      if (error) {
        console.error("[cardService.SearchCards] Database error:", error);
        throw error;
      }

      console.log(`[cardService.SearchCards] Found ${data?.length || 0} cards`);
      return { data: data as Card[], error: null };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("[cardService.SearchCards] Exception:", errorMsg, error);
      return { data: [], error };
    }
  },

  async getCardById(cardId: string) {
    const supabase = getSupabaseClient(); // Get client lazily
    const { data, error } = await supabase
      .from("cards")
      .select("*")
      .eq("card_id", cardId)
      .single();

    if (error) {
      console.error("Error fetching card:", error);
      return null;
    }

    return data as Card;
  },
};
