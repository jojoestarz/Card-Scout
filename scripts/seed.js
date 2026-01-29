const { JustTCG } = require('justtcg-js');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// ------------------------------------------------------------------
// 1. Setup & Config
// ------------------------------------------------------------------

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || "https://ynhdlnqtzbolovuaxcqx.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.EXPO_PUBLIC_SUPABASE_KEY;
const JUSTTCG_API_KEY = process.env.JUSTTCG_API_KEY;

if (!SUPABASE_KEY) {
  console.error("❌ Missing SUPABASE_SERVICE_KEY or EXPO_PUBLIC_SUPABASE_KEY");
  process.exit(1);
}
if (!JUSTTCG_API_KEY) {
  console.error("❌ Missing JUSTTCG_API_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const justTcg = new JustTCG({ apiKey: JUSTTCG_API_KEY });

// ------------------------------------------------------------------
// 2. Helpers
// ------------------------------------------------------------------

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Generic Upsert Helper
 * Directly sends data to Supabase and handles errors.
 */
async function upsertBatch(table, rows, conflictKey) {
  if (!rows || rows.length === 0) return;

  const { error } = await supabase
    .from(table)
    .upsert(rows, { onConflict: conflictKey });

  if (error) {
    console.error(`❌ Error upserting to ${table}:`, error.message);
    throw error;
  }
}

// ------------------------------------------------------------------
// 3. Transform Functions
// ------------------------------------------------------------------

const mapSet = (set) => ({
  set_id: set.id,
  set_name: set.name,
  release_date: set.releaseDate,
});

const mapCard = (card) => ({
  card_id: card.id,
  name: card.name,
  set_id: card.set,
  card_number: card.number,
  rarity: card.rarity,
});

const mapVariants = (card) => {
  //TODO: add imageurls and other fields later
  if (!card.variants) return [];
  return card.variants.map((v) => ({
    variant_id: v.id,
    card_id: card.id,
    printing: v.printing,
    condition: v.condition,
    market_price: v.price,
    last_updated: v.lastUpdated,
  }));
};

// ------------------------------------------------------------------
// 4. Core Pipeline Logic
// ------------------------------------------------------------------

/**
 * Fetches all cards for a specific set using pagination.
 * Processes each page (cards + variants) IMMEDIATELY to save memory.
 */
async function processCardsForSet(setId) {
  let offset = 0;
  const limit = 50;
  let hasMore = true;
  let totalCardsProcessed = 0;

  console.log(`\n🃏 Processing Set: ${setId}`);

  while (hasMore) {
    const response = await justTcg.v1.cards.list({
      game: "one-piece-card-game",
      set: setId,
      limit,
      offset,
    });

    if (response.error) {
      throw new Error(`API Error on set ${setId}: ${response.error}`);
    }

    const cards = response.data || [];
    
    if (cards.length > 0) {
      // Transform and flatMap variants
      const dbCards = cards.map(mapCard);
      const dbVariants = cards.flatMap(mapVariants);

      // Batch Upsert
      await upsertBatch('cards', dbCards, 'card_id');
      await upsertBatch('variations', dbVariants, 'variant_id');

      totalCardsProcessed += cards.length;
      process.stdout.write(`   ↳ Synced ${cards.length} cards & ${dbVariants.length} variants (Offset: ${offset})\r`);
    }

    if (response.pagination && response.pagination.hasMore) {
      offset += cards.length;
      await sleep(300); // Respect Rate Limit
    } else {
      hasMore = false;
    }
  }
  console.log(`   ✅ Finished Set: ${setId}. Total: ${totalCardsProcessed} cards.`);
}

/**
 * Main Orchestrator
 */
async function syncAll() {
  console.log("🚀 Starting Ingestion Pipeline (JavaScript Edition)...");

  // --- Step 1: Sync Sets ---
  console.log("📦 Fetching Sets...");
  let allSets = [];
  let setOffset = 0;
  let setsMore = true;

  while(setsMore) {
    const res = await justTcg.v1.sets.list({ game: "one-piece-card-game", limit: 50, offset: setOffset });
    if (res.error) throw new Error(`Set Fetch Error: ${res.error}`);
    
    allSets.push(...res.data);
    if(res.pagination && res.pagination.hasMore) {
      setOffset += res.data.length;
      await sleep(200);
    } else {
      setsMore = false;
    }
  }

  console.log(`Found ${allSets.length} sets.`);
  const dbSets = allSets.map(mapSet);
  await upsertBatch('card_set', dbSets, 'set_id'); 
  console.log("✅ Sets synced.");

  // --- Step 2: Stream Cards & Variants per Set ---
  for (const set of allSets) {
    try {
      await processCardsForSet(set.id);
      await sleep(500); // Breather between sets
    } catch (err) {
      console.error(`❌ Failed to process set ${set.id}:`, err.message);
      // Continue to next set instead of crashing the whole sync
    }
  }

  console.log("\n✨ Full Sync Complete!");
}

// ------------------------------------------------------------------
// Run
// ------------------------------------------------------------------

syncAll().catch((e) => {
  console.error("FATAL ERROR:", e);
  process.exit(1);
});
