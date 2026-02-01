import { JustTCG } from "justtcg-js";
import { createClient } from "@supabase/supabase-js";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url"; // Required to recreate __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });
import axios from "axios";
// ------------------------------------------------------------------
// Client Setup
// ------------------------------------------------------------------
const apiKey = process.env.JUSTTCG_API_KEY || process.env.TCG_API_KEY;

if (!apiKey)
  throw new Error(
    "Missing JUSTTCG_API_KEY or TCG_API_KEY in environment variables",
  );

const client = new JustTCG({ apiKey });

const supabase = createClient(
  "https://ynhdlnqtzbolovuaxcqx.supabase.co",
  process.env.SUPABASE_SERVICE_KEY,
);

if (!process.env.SUPABASE_SERVICE_KEY) {
  console.warn(
    "⚠️  WARNING: SUPABASE_SERVICE_KEY is missing. Writes may fail due to RLS.",
  );
}

  const BUCKET_NAME = 'card-images';
// ------------------------------------------------------------------
// Utilities
// ------------------------------------------------------------------

// Helper to clean integer values (handles "NULL" string from API)
const cleanInt = (val) => {
  if (val === "NULL" || val === null || val === undefined || val === "")
    return null;
  // If it's already a number, return it
  if (typeof val === "number") return val;
  const num = parseInt(val, 10);
  return isNaN(num) ? null : num;
};



//TODO:  Fetch & Upsert Sets:
async function fetchAndUpsertSets() {
  const optcgurl = "https://www.optcgapi.com/api/allSets/";
  try {
    console.log("Fetching sets from OPTCG API...");
    const AllSets = await fetch(optcgurl);
    if (AllSets.ok) {
      const setsData = await AllSets.json();
      const dbSets = setsData.map((set) => ({
        set_id: set.set_id,
        set_name: set.set_name,
      }));
      const { data, error } = await supabase
        .from("card_set")
        .upsert(dbSets, { onConflict: "set_id" })
        .select();
      if (error) {
        console.error(
          "❌ Supabase Upsert Error DETAILS:",
          JSON.stringify(error, null, 2),
        );
      } else {
        console.log(`✅ Success! Upserted ${data?.length} rows.`);
      }
    }
  } catch (error) {
    console.error("❌ Error in fetchAndUpsertSets:", error.message);
  }
}

// ------------------------------------------------------------------
// Image Handling 
// ------------------------------------------------------------------
let missedImages = [];
async function processCardImage(card_id, set_id, source_url) {
  if (!source_url) {
    missedImages.push(card_id);
    return console.warn(`⚠️  No source URL for card ${card_id}`);
  }

  const fileName = `${card_id}.png`;
  const filePath = `${set_id}/${fileName}`;
  
  try {
    // Check if it exists in storage already
    const { data: existingFile } = await supabase.storage
      .from(BUCKET_NAME)
      .list(set_id, {
        search: fileName,
      });
    if (existingFile) {
      // File already exists, skip upload
      process.stdout.write(`ℹ️  Skipping (exists): ${filePath}\r`);
      return;
    }

    // 2. Download from OPTCG API source
    const response = await axios.get(source_url, {
      responseType: 'arraybuffer'
    });
    const fileBuffer = Buffer.from(response.data);
    console.log(`fileBuffer length: ${fileBuffer.length}`);
    

    // 3. Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, fileBuffer, {
        upsert: true,
      });
    if (uploadError)
    {
      console.error('❌ Upload error:', uploadError);
      throw uploadError; 
    }
    else
    {
      process.stdout.write(`✅ Uploaded: ${filePath}\r`);
     }

  } catch (error) {
    console.error(`❌ Failed image for ${card_id}:`, error.message);
  }
}


async function syncImagesToStorage(cards) {
  console.log(`\n🖼️  Starting Image Sync for ${cards.length} cards...`);
  
  const batchSize = 20; // Concurrent uploads
  try {
  for (let i = 0; i < cards.length; i += batchSize) {
    const batch = cards.slice(i, i + batchSize);
    
    await Promise.all(
      batch.map(card => processCardImage(
        card.card_set_id, 
        card.set_id, 
        card.card_image
      ))
    );
    const progress = Math.round(((i + batch.length) / cards.length) * 100);
    process.stdout.write(`   ↳ Image Sync Progress: ${progress}% \r`);
    
  }
    console.log(`missedImages: ${missedImages.length}`);


  } catch (error) {
    console.error("❌ Error during image sync:", error.message);
  }
}
// sets url to supabase storage location
function getDeterministicPublicUrl(set_id, card_id)
{ 
  const { data } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(`${set_id}/${card_id}.png`);
  return data.publicUrl;
}

//TODO: Fetch & Upsert Cards:

async function fetchAndUpsertCards() {
  const optcgurl = "https://www.optcgapi.com/api/allSetCards/";
  try {
    console.log("Fetching cards from OPTCG API...");
    const AllCards = await fetch(optcgurl);
    if (AllCards.ok) {
      const cardsData = await AllCards.json();

    // 1. Deduplicate with priority for valid images
    const uniqueCardsMap = new Map();
    cardsData.forEach((card) => {
      const id = card.card_set_id;
      if (!id) return;

      if (!uniqueCardsMap.has(id)) {
        // New entry
        uniqueCardsMap.set(id, card);
      } else {
        // Conflict: Decide who wins
        const existing = uniqueCardsMap.get(id);
        
        // Priority 1: Has Image vs No Image
        const currentHasImage = !!card.card_image;
        const existingHasImage = !!existing.card_image;

        if (currentHasImage && !existingHasImage) {
           uniqueCardsMap.set(id, card);
        } 
        // Priority 2: If both have images (or both don't), prefer the one WITHOUT "Parallel" or "Reprint" in name
        // (This helps get the base art for the base ID)
        else if (currentHasImage === existingHasImage) {
           const currentIsClean = !card.card_name.includes('Parallel') && !card.card_name.includes('Reprint');
           const existingIsClean = !existing.card_name.includes('Parallel') && !existing.card_name.includes('Reprint');
           
           if (currentIsClean && !existingIsClean) {
               uniqueCardsMap.set(id, card);
           }
        }
      }
    });
      const uniqueCardsData = Array.from(uniqueCardsMap.values());
      // 2. PREPARATION: Fill the bucket (The separate function)
      await syncImagesToStorage(uniqueCardsData);

      // 3. Map Data (Now purely mapping, no network calls for images)
      const dbCards = uniqueCardsData.map((card) => ({
        card_id: card.card_set_id,
        name: card.card_name,
        set_id: card.set_id,
        rarity: card.rarity,
        cost: cleanInt(card.card_cost),
        power: cleanInt(card.card_power),
        colour: card.card_color,
        attribute: card.attribute,
        effect: card.card_text,
        card_type: card.card_type,
        sub_type: card.sub_types,
        life: cleanInt(card.life),
        counter: cleanInt(card.counter_amount),
        // We construct the URL deterministically, knowing syncImagesToStorage put it there
        image_url: getDeterministicPublicUrl(card.set_id, card.card_set_id)
      }));
      

      // 4. Upsert in batches (Database logic only)
      const batchSize = 1000;
      for (let i = 0; i < dbCards.length; i += batchSize) {
        const batch = dbCards.slice(i, i + batchSize);
        console.log(`Upserting DB batch ${Math.floor(i / batchSize) + 1}...`);

        const { error } = await supabase
          .from("cards")
          .upsert(batch, { onConflict: "card_id" });

        if (error) {
          console.error("❌ Batch Upsert Error:", JSON.stringify(error, null, 2));
        }
      }
      console.log("✅ Card sync complete.");
    }
  } catch (error) {
    console.error("❌ Error in fetchAndUpsertCards:", error.message);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const forceImages = args.includes('--force-images');
  
  // Basic Routing
  // In the future, we can check for --target=market, etc.
  // Default behavior: Run Base Layer
  
  console.log("🚀 Starting Ingestion Pipeline...");
  console.log("--------------------------------");
  console.log(`Target: Base Layer (OPTCG)`);
  console.log(`Force Images: ${forceImages ? 'YES' : 'NO'}`);
  console.log("--------------------------------");

  await fetchAndUpsertSets();
  await fetchAndUpsertCards({ forceImages });
  
  console.log("\n✨ Pipeline Execution Finished.");
}
main();