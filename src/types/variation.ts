export interface Variation {
  variations_id: string;
  card_id: string;
  printing: string;
  version: string | null;
  image_url: string | null;
  note: string | null;
  justtcg_variant_id: string | null;
  tcgplayer_id: string | null;
}
