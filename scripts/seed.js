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

const BUCKET_NAME = "card-images";
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
let uploadFailures = [];
let uploadSuccesses = new Set();

async function processCardImage(card_id, set_id, source_url, retries = 3) {
  if (!source_url) {
    missedImages.push({ card_id, reason: "No source URL" });
    return { success: false, card_id };
  }

  const fileName = `${card_id}.png`;
  const filePath = `${set_id}/${fileName}`;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      // Check if it exists in storage already - FIXED: check array length
      const { data: existingFiles, error: listError } = await supabase.storage
        .from(BUCKET_NAME)
        .list(set_id, {
          search: fileName,
        });

      if (listError) {
        console.warn(`⚠️  List error for ${filePath}:`, listError.message);
      }

      // FIXED: Check if array has items, not just if data is truthy
      if (existingFiles && existingFiles.length > 0) {
        // Verify the file actually exists by trying to get its public URL
        const { data: urlData } = supabase.storage
          .from(BUCKET_NAME)
          .getPublicUrl(filePath);

        if (urlData?.publicUrl) {
          uploadSuccesses.add(card_id);
          process.stdout.write(`ℹ️  Exists: ${filePath}\r`);
          return { success: true, card_id };
        }
      }

      // Download from OPTCG API source with timeout
      const response = await axios.get(source_url, {
        responseType: "arraybuffer",
        timeout: 15000, // 15 second timeout
        maxContentLength: 5 * 1024 * 1024, // 5MB max
      });

      const fileBuffer = Buffer.from(response.data);

      if (fileBuffer.length === 0) {
        throw new Error("Downloaded file is empty");
      }

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, fileBuffer, {
          contentType: "image/png",
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      // Verify upload succeeded by checking file exists
      const { data: verifyFiles } = await supabase.storage
        .from(BUCKET_NAME)
        .list(set_id, { search: fileName });

      if (!verifyFiles || verifyFiles.length === 0) {
        throw new Error(
          "Upload verification failed - file not found after upload",
        );
      }

      uploadSuccesses.add(card_id);
      process.stdout.write(`✅ Uploaded: ${filePath}\r`);
      return { success: true, card_id };
    } catch (error) {
      if (attempt < retries - 1) {
        // Retry with exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
        process.stdout.write(
          `⚠️  Retry ${attempt + 1}/${retries - 1} for ${card_id} in ${delay}ms...\r`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        // Final failure
        console.error(
          `\n❌ Failed image for ${card_id} after ${retries} attempts:`,
          error.message,
        );
        uploadFailures.push({
          card_id,
          set_id,
          source_url,
          error: error.message,
        });
        return { success: false, card_id };
      }
    }
  }

  return { success: false, card_id };
}

async function syncImagesToStorage(cards) {
  console.log(`\n🖼️  Starting Image Sync for ${cards.length} cards...`);

  const batchSize = 20; // Concurrent uploads
  const results = [];
  try {
    for (let i = 0; i < cards.length; i += batchSize) {
      const batch = cards.slice(i, i + batchSize);

      // Process batch with proper error handling
      const batchResults = await Promise.allSettled(
        batch.map((card) =>
          processCardImage(card.card_set_id, card.set_id, card.card_image),
        ),
      );

      results.push(...batchResults);

      const progress = Math.round(((i + batch.length) / cards.length) * 100);
      process.stdout.write(`   ↳ Image Sync Progress: ${progress}% \r`);

      // Small delay between batches to avoid rate limiting
      if (i + batchSize < cards.length) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    console.log(`\n\n📊 Image Sync Summary:`);
    console.log(`   ✅ Successful uploads: ${uploadSuccesses.size}`);
    console.log(`   ⚠️  Missing source URLs: ${missedImages.length}`);
    console.log(`   ❌ Upload failures: ${uploadFailures.length}`);

    if (uploadFailures.length > 0) {
      console.log(`\n⚠️  Failed uploads details:`);
      uploadFailures.slice(0, 10).forEach((fail) => {
        console.log(`   - ${fail.card_id}: ${fail.error}`);
      });
      if (uploadFailures.length > 10) {
        console.log(`   ... and ${uploadFailures.length - 10} more`);
      }
    }
  } catch (error) {
    console.error("❌ Error during image sync:", error.message);
  }
}
// sets url to supabase storage location
function getDeterministicPublicUrl(set_id, card_id) {
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
            const currentIsClean =
              !card.card_name.includes("Parallel") &&
              !card.card_name.includes("Reprint");
            const existingIsClean =
              !existing.card_name.includes("Parallel") &&
              !existing.card_name.includes("Reprint");

            if (currentIsClean && !existingIsClean) {
              uniqueCardsMap.set(id, card);
            }
          }
        }
      });
      const uniqueCardsData = Array.from(uniqueCardsMap.values());
      // 2. PREPARATION: Fill the bucket (The separate function)
      await syncImagesToStorage(uniqueCardsData);

      // 3. Map Data - Only set image_url if upload was successful
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
        // Only set image_url if the upload was successful
        image_url: uploadSuccesses.has(card.card_set_id)
          ? getDeterministicPublicUrl(card.set_id, card.card_set_id)
          : null,
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
          console.error(
            "❌ Batch Upsert Error:",
            JSON.stringify(error, null, 2),
          );
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
  const forceImages = args.includes("--force-images");

  // Basic Routing
  // In the future, we can check for --target=market, etc.
  // Default behavior: Run Base Layer

  console.log("🚀 Starting Ingestion Pipeline...");
  console.log("--------------------------------");
  console.log(`Target: Base Layer (OPTCG)`);
  console.log(`Force Images: ${forceImages ? "YES" : "NO"}`);
  console.log("--------------------------------");

  await fetchAndUpsertSets();
  await fetchAndUpsertCards({ forceImages });

  console.log("\n✨ Pipeline Execution Finished.");
}
main();
