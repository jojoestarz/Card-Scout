export interface Card { 
    card_id: string;      // e.g., "OP01-001"
    name: string;
    set_id: string;
    rarity: string;
    cost: number | null;
    power: number | null;
    colour: string;
    attribute: string;
    effect: string;
    card_type: string;
    counter: number | null;
    life: number | null;
    sub_type: string | null;
    image_url: string | null;    // Your public Supabase Storage URL
}