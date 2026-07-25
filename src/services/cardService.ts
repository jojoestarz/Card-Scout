import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Card } from "../types/card";
import type { Variation } from "../types/variation";

const SUPABASE_URL = "https://ynhdlnqtzbolovuaxcqx.supabase.co";
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || SUPABASE_URL;

const CARD_ID_PATTERN = /^OP\d{2}-\d{3}$/i;

// Lazy initialization - only create client when first accessed
let _supabase: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (!_supabase) {
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

function sortVariations(variations: Variation[]): Variation[] {
  const order = ["normal", "parallel", "reprint", "manga"];
  return [...variations].sort((a, b) => {
    const aIdx = order.indexOf(a.printing);
    const bIdx = order.indexOf(b.printing);
    const aOrder = aIdx === -1 ? order.length : aIdx;
    const bOrder = bIdx === -1 ? order.length : bIdx;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.printing.localeCompare(b.printing);
  });
}

export interface SearchCardsParams {
  searchTerm?: string;
  colour?: string;
  card_id?: string;
  card_type?: string;
  attribute?: string;
  rarity?: string;
  set_id?: string;
  leadersOnly?: boolean;
  limit?: number;
  offset?: number;
}

export const cardService = {
  async SearchCards({
    searchTerm = "",
    colour,
    card_id,
    card_type,
    attribute,
    rarity,
    set_id,
    leadersOnly,
    limit = 20,
    offset = 0,
  }: SearchCardsParams = {}) {
    try {
      console.log("[cardService.SearchCards] Query:", {
        searchTerm,
        colour,
        card_id,
        card_type,
        attribute,
        rarity,
        set_id,
        leadersOnly,
        limit,
        offset,
      });

      const supabase = getSupabaseClient();
      let query = supabase.from("cards").select("*");

      if (searchTerm) {
        console.log("[SearchCards] Applying searchTerm filter:", searchTerm);
        const term = searchTerm.trim();
        if (CARD_ID_PATTERN.test(term)) {
          query = query.eq("card_id", term.toUpperCase());
        } else {
          query = query.ilike("name", `%${term}%`);
        }
      }

      if (colour) {
        console.log("[SearchCards] Applying colour filter:", colour);
        query = query.eq("colour", colour);
      }

      if (card_id) {
        console.log("[SearchCards] Applying card_id filter:", card_id);
        query = query.eq("card_id", card_id);
      }

      if (leadersOnly) {
        console.log("[SearchCards] Applying leadersOnly filter");
        query = query.eq("card_type", "Leader");
      } else if (card_type) {
        console.log("[SearchCards] Applying card_type filter:", card_type);
        query = query.eq("card_type", card_type);
      }

      if (attribute) {
        console.log("[SearchCards] Applying attribute filter:", attribute);
        query = query.eq("attribute", attribute);
      }

      if (rarity) {
        console.log("[SearchCards] Applying rarity filter:", rarity);
        query = query.eq("rarity", rarity);
      }

      if (set_id) {
        console.log("[SearchCards] Applying set_id filter:", set_id);
        query = query.eq("set_id", set_id);
      }

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
    return this.getCardWithVariations(cardId);
  },

  async getCardWithVariations(cardId: string): Promise<Card | null> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("cards")
      .select("*, variations(*)")
      .eq("card_id", cardId)
      .single();

    if (error) {
      console.error("Error fetching card with variations:", error);
      return null;
    }

    const card = data as Card;
    if (card.variations) {
      card.variations = sortVariations(card.variations);
    }

    return card;
  },

  async getVariationById(variationsId: string): Promise<Variation | null> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("variations")
      .select("*")
      .eq("variations_id", variationsId)
      .single();

    if (error) {
      console.error("Error fetching variation:", error);
      return null;
    }

    return data as Variation;
  },
};
