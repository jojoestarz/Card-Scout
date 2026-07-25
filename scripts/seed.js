import { JustTCG } from "justtcg-js";
import { createClient } from "@supabase/supabase-js";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import axios from "axios";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });

// ------------------------------------------------------------------
// Client Setup
// ------------------------------------------------------------------
const supabase = createClient(
  "https://ynhdlnqtzbolovuaxcqx.supabase.co",
  process.env.SUPABASE_SERVICE_KEY,
);

if (!process.env.SUPABASE_SERVICE_KEY) {
  console.warn(
    "⚠️  WARNING: SUPABASE_SERVICE_KEY is missing. Writes may fail due to RLS.",
  );
}

let justTcgClient = null;

function getJustTCGClient() {
  const apiKey = process.env.JUSTTCG_API_KEY || process.env.TCG_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing JUSTTCG_API_KEY or TCG_API_KEY (required for --sync-prices)",
    );
  }
  if (!justTcgClient) {
    justTcgClient = new JustTCG({ apiKey });
  }
  return justTcgClient;
}

const BUCKET_NAME = "card-images";

// ------------------------------------------------------------------
// Utilities
// ------------------------------------------------------------------
const cleanInt = (val) => {
  if (val === "NULL" || val === null || val === undefined || val === "")
    return null;
  if (typeof val === "number") return val;
  const num = parseInt(val, 10);
  return isNaN(num) ? null : num;
};

function derivePrinting(cardName) {
  if (cardName.includes("Parallel")) return "parallel";
  if (cardName.includes("Reprint")) return "reprint";
  if (cardName.includes("Manga")) return "manga";
  return "normal";
}

function buildVariationsId(cardId, printing) {
  return `${cardId}:${printing}`;
}

function toStorageFileName(variationsId) {
  return `${variationsId.replace(/:/g, "_")}.png`;
}

function pickCanonicalRow(rows) {
  const sorted = [...rows].sort((a, b) => {
    const aClean =
      !a.card_name.includes("Parallel") && !a.card_name.includes("Reprint");
    const bClean =
      !b.card_name.includes("Parallel") && !b.card_name.includes("Reprint");
    if (aClean !== bClean) return aClean ? -1 : 1;

    const aHasImage = !!a.card_image;
    const bHasImage = !!b.card_image;
    if (aHasImage !== bHasImage) return aHasImage ? -1 : 1;

    return a.card_name.localeCompare(b.card_name);
  });
  return sorted[0];
}

function groupByCardId(cardsData) {
  const groups = new Map();
  for (const card of cardsData) {
    const id = card.card_set_id;
    if (!id) continue;
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(card);
  }
  return groups;
}

function mergeRowsByPrinting(rows) {
  const byPrinting = new Map();
  for (const row of rows) {
    const printing = derivePrinting(row.card_name);
    const existing = byPrinting.get(printing);
    if (!existing) {
      byPrinting.set(printing, row);
      continue;
    }

    const currentHasImage = !!row.card_image;
    const existingHasImage = !!existing.card_image;
    if (currentHasImage && !existingHasImage) {
      byPrinting.set(printing, row);
    }
  }
  return byPrinting;
}

// ------------------------------------------------------------------
// Sets
// ------------------------------------------------------------------
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

async function storageFileExists(setId, fileName) {
  const { data: existingFiles, error: listError } = await supabase.storage
    .from(BUCKET_NAME)
    .list(setId, { search: fileName });

  if (listError) {
    console.warn(`⚠️  List error for ${setId}/${fileName}:`, listError.message);
    return false;
  }

  return existingFiles && existingFiles.length > 0;
}

function getDeterministicPublicUrl(setId, storageFileName) {
  const { data } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(`${setId}/${storageFileName}`);
  return data.publicUrl;
}

async function processVariantImage(
  { variationsId, cardId, setId, sourceUrl, printing },
  { forceImages = false, skipUpload = false } = {},
  retries = 3,
) {
  if (skipUpload) {
    const fileName = toStorageFileName(variationsId);
    if (await storageFileExists(setId, fileName)) {
      uploadSuccesses.add(variationsId);
      return { success: true, variationsId, publicUrl: getDeterministicPublicUrl(setId, fileName) };
    }
    if (printing === "normal" && (await storageFileExists(setId, `${cardId}.png`))) {
      uploadSuccesses.add(variationsId);
      return {
        success: true,
        variationsId,
        publicUrl: getDeterministicPublicUrl(setId, `${cardId}.png`),
      };
    }
    return { success: false, variationsId, publicUrl: null };
  }

  if (!sourceUrl) {
    missedImages.push({ variationsId, reason: "No source URL" });
    return { success: false, variationsId, publicUrl: null };
  }

  const fileName = toStorageFileName(variationsId);
  const filePath = `${setId}/${fileName}`;
  const legacyFileName = `${cardId}.png`;
  const legacyPath = `${setId}/${legacyFileName}`;

  if (!forceImages) {
    if (await storageFileExists(setId, fileName)) {
      uploadSuccesses.add(variationsId);
      process.stdout.write(`ℹ️  Exists: ${filePath}\r`);
      return {
        success: true,
        variationsId,
        publicUrl: getDeterministicPublicUrl(setId, fileName),
      };
    }

    if (printing === "normal" && (await storageFileExists(setId, legacyFileName))) {
      uploadSuccesses.add(variationsId);
      process.stdout.write(`ℹ️  Legacy exists: ${legacyPath}\r`);
      return {
        success: true,
        variationsId,
        publicUrl: getDeterministicPublicUrl(setId, legacyFileName),
      };
    }
  }

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await axios.get(sourceUrl, {
        responseType: "arraybuffer",
        timeout: 15000,
        maxContentLength: 5 * 1024 * 1024,
      });

      const fileBuffer = Buffer.from(response.data);
      if (fileBuffer.length === 0) {
        throw new Error("Downloaded file is empty");
      }

      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, fileBuffer, {
          contentType: "image/png",
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      if (!(await storageFileExists(setId, fileName))) {
        throw new Error(
          "Upload verification failed - file not found after upload",
        );
      }

      uploadSuccesses.add(variationsId);
      process.stdout.write(`✅ Uploaded: ${filePath}\r`);
      return {
        success: true,
        variationsId,
        publicUrl: getDeterministicPublicUrl(setId, fileName),
      };
    } catch (error) {
      if (attempt < retries - 1) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
        process.stdout.write(
          `⚠️  Retry ${attempt + 1}/${retries - 1} for ${variationsId} in ${delay}ms...\r`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        console.error(
          `\n❌ Failed image for ${variationsId} after ${retries} attempts:`,
          error.message,
        );
        uploadFailures.push({
          variationsId,
          cardId,
          setId,
          source_url: sourceUrl,
          error: error.message,
        });
        return { success: false, variationsId, publicUrl: null };
      }
    }
  }

  return { success: false, variationsId, publicUrl: null };
}

async function syncVariantImages(variantRows, { forceImages = false, skipUpload = false } = {}) {
  console.log(`\n🖼️  Starting Variant Image Sync for ${variantRows.length} rows...`);

  const imageUrlByVariationId = new Map();
  const batchSize = 20;

  try {
    for (let i = 0; i < variantRows.length; i += batchSize) {
      const batch = variantRows.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(
        batch.map((variant) =>
          processVariantImage(variant, { forceImages, skipUpload }),
        ),
      );

      for (const result of batchResults) {
        if (result.status === "fulfilled" && result.value.success && result.value.publicUrl) {
          imageUrlByVariationId.set(result.value.variationsId, result.value.publicUrl);
        }
      }

      const progress = Math.round(((i + batch.length) / variantRows.length) * 100);
      process.stdout.write(`   ↳ Image Sync Progress: ${progress}% \r`);

      if (i + batchSize < variantRows.length) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    console.log(`\n\n📊 Image Sync Summary:`);
    console.log(`   ✅ Successful uploads/exists: ${uploadSuccesses.size}`);
    console.log(`   ⚠️  Missing source URLs: ${missedImages.length}`);
    console.log(`   ❌ Upload failures: ${uploadFailures.length}`);

    if (uploadFailures.length > 0) {
      console.log(`\n⚠️  Failed uploads details:`);
      uploadFailures.slice(0, 10).forEach((fail) => {
        console.log(`   - ${fail.variationsId}: ${fail.error}`);
      });
      if (uploadFailures.length > 10) {
        console.log(`   ... and ${uploadFailures.length - 10} more`);
      }
    }
  } catch (error) {
    console.error("❌ Error during image sync:", error.message);
  }

  return imageUrlByVariationId;
}

// ------------------------------------------------------------------
// Cards + Variations
// ------------------------------------------------------------------
async function fetchAllOptcgCards() {
  const optcgurl = "https://www.optcgapi.com/api/allSetCards/";
  console.log("Fetching cards from OPTCG API...");
  const AllCards = await fetch(optcgurl);
  if (!AllCards.ok) {
    throw new Error(`OPTCG API error: ${AllCards.status}`);
  }
  return AllCards.json();
}

function buildCardAndVariationRecords(cardsData) {
  const groups = groupByCardId(cardsData);
  const dbCards = [];
  const dbVariations = [];
  const variantImageJobs = [];

  for (const [cardId, rows] of groups) {
    const canonical = pickCanonicalRow(rows);
    const mergedByPrinting = mergeRowsByPrinting(rows);

    dbCards.push({
      card_id: cardId,
      name: canonical.card_name,
      set_id: canonical.set_id,
      rarity: canonical.rarity,
      cost: cleanInt(canonical.card_cost),
      power: cleanInt(canonical.card_power),
      colour: canonical.card_color,
      attribute: canonical.attribute,
      effect: canonical.card_text,
      card_type: canonical.card_type,
      sub_type: canonical.sub_types,
      life: cleanInt(canonical.life),
      counter: cleanInt(canonical.counter_amount),
      image_url: null,
    });

    for (const [printing, row] of mergedByPrinting) {
      const variationsId = buildVariationsId(cardId, printing);
      dbVariations.push({
        variations_id: variationsId,
        card_id: cardId,
        printing,
        version: printing,
        image_url: null,
        note: null,
        justtcg_variant_id: null,
        tcgplayer_id: null,
      });

      variantImageJobs.push({
        variationsId,
        cardId,
        setId: row.set_id,
        sourceUrl: row.card_image,
        printing,
      });
    }
  }

  return { dbCards, dbVariations, variantImageJobs };
}

async function upsertInBatches(table, rows, onConflict) {
  const batchSize = 1000;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    console.log(`Upserting ${table} batch ${Math.floor(i / batchSize) + 1}...`);
    const { error } = await supabase.from(table).upsert(batch, { onConflict });
    if (error) {
      console.error(
        `❌ ${table} batch upsert error:`,
        JSON.stringify(error, null, 2),
      );
    }
  }
}

async function fetchAndUpsertCards({ forceImages = false, skipImages = false } = {}) {
  try {
    const cardsData = await fetchAllOptcgCards();
    const { dbCards, dbVariations, variantImageJobs } =
      buildCardAndVariationRecords(cardsData);

    console.log(
      `Grouped ${cardsData.length} OPTCG rows → ${dbCards.length} cards, ${dbVariations.length} variations`,
    );

    const imageUrlByVariationId = await syncVariantImages(variantImageJobs, {
      forceImages,
      skipUpload: skipImages,
    });

    for (const variation of dbVariations) {
      const url = imageUrlByVariationId.get(variation.variations_id);
      if (url) {
        variation.image_url = url;
      }
    }

    for (const card of dbCards) {
      const normalUrl = imageUrlByVariationId.get(`${card.card_id}:normal`);
      if (normalUrl) {
        card.image_url = normalUrl;
      }
    }

    await upsertInBatches("cards", dbCards, "card_id");
    await upsertInBatches("variations", dbVariations, "variations_id");

    console.log("✅ Card + variation sync complete.");
  } catch (error) {
    console.error("❌ Error in fetchAndUpsertCards:", error.message);
  }
}

// ------------------------------------------------------------------
// JustTCG pricing (Phase 2 stub — only with --sync-prices)
// ------------------------------------------------------------------
async function syncPricesFromJustTCG() {
  getJustTCGClient();
  console.log(
    "ℹ️  JustTCG price sync is deferred to Phase 2. Client initialized; no pricing writes yet.",
  );
}

// ------------------------------------------------------------------
// Main
// ------------------------------------------------------------------
async function main() {
  const args = process.argv.slice(2);
  const setsOnly = args.includes("--sets-only");
  const cardsOnly = args.includes("--cards-only");
  const forceImages = args.includes("--force-images");
  const syncPrices = args.includes("--sync-prices");

  console.log("🚀 Starting Ingestion Pipeline...");
  console.log("--------------------------------");
  console.log(`Target: Base Layer (OPTCG)`);
  console.log(`Sets Only: ${setsOnly ? "YES" : "NO"}`);
  console.log(`Cards Only: ${cardsOnly ? "YES" : "NO"}`);
  console.log(`Force Images: ${forceImages ? "YES" : "NO"}`);
  console.log(`Sync Prices: ${syncPrices ? "YES" : "NO"}`);
  console.log("--------------------------------");

  if (setsOnly) {
    await fetchAndUpsertSets();
  } else if (cardsOnly) {
    await fetchAndUpsertCards({ forceImages, skipImages: !forceImages });
  } else {
    await fetchAndUpsertSets();
    await fetchAndUpsertCards({ forceImages, skipImages: false });
  }

  if (syncPrices) {
    await syncPricesFromJustTCG();
  }

  console.log("\n✨ Pipeline Execution Finished.");
}

main();
