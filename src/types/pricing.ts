export interface VariantPricing {
  variation_id: string;
  price_usd: number | null;
  price_change_7d: number | null;
  avg_price_7d: number | null;
  price_history: { date: string; price: number }[] | null;
  last_updated: string | null;
}
