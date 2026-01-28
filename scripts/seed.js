const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env" });
const { JustTCG } = require("justtcg-js");

const SUPABASE_URL = "https://ynhdlnqtzbolovuaxcqx.supabase.co";

const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
let set_names = [];

async function seed() {
  // Create TCG client
  try {
    const client = new JustTCG({ apiKey: process.env.TCG_API_KEY });
    const limit = 20;
    let offset = 0;
    let allSets = [];
    let hasMore = true;

    console.log("Starting set ingestion...");

    while (hasMore) {
      console.log(`Fetching sets with offset ${offset}...`);
      const response = await client.v1.sets.list({
        game: "one-piece-card-game",
        limit,
        offset,
      });

      if (response.error) {
        throw new Error(
          `API Error: ${response.error} (Code: ${response.code})`,
        );
      }

      const { data, pagination, usage } = response;

      // Log Usage Metadata
      if (usage) {
        console.log("--- API Usage ---");
        console.log(
          `Daily Requests: ${usage.apiDailyRequestsUsed}/${usage.apiDailyLimit}`,
        );
        console.log(`Daily Remaining: ${usage.apiDailyRequestsRemaining}`);
        console.log(`Rate Limit Remaining: ${usage.apiRequestsRemaining}`);

        if (usage.apiDailyRequestsRemaining <= 1) {
          console.warn(
            "⚠️ Daily request limit reached or nearly exhausted. Stopping to prevent overage.",
          );
          break;
        }
      }
      
      if (data && data.length > 0) {
        allSets = allSets.concat(data);
        offset += data.length;
        console.log(
          `Fetched ${data.length} sets. Total loaded so far: ${allSets.length}`,
        );
      }

      // Handle Pagination
      if (pagination) {
        console.log(`Pagination Info: Current Page: ${pagination.page}, Total Pages: ${pagination.totalPages}`);
        hasMore = pagination.hasMore;
        if (pagination.total) {
          console.log(
            `Progress: ${Math.round((allSets.length / pagination.total) * 100)}% (${allSets.length}/${pagination.total})`,
          );
        }
      } else {
        hasMore = false;
      }

      if (hasMore) {
        // Rate limit: 10 requests/minute -> 6 seconds delay
        console.log("Waiting 6s to respect rate limit...");
        await new Promise((resolve) => setTimeout(resolve, 6000));
      }
    }

    console.log("\n--- Ingestion Complete ---");
    console.log(`Total Sets Fetched: ${allSets.length}`);

    // Print set names exactly once
    console.log("\nSet Names:");
    for (const set of allSets) {
      set_names.push(set);
    }
    
    
  } catch (error) {
    console.error("Error fetching sets:", error.message);
    process.exit(1);
  }
  orderedSets = set_names.sort((a, b) => {
    if (a.release_date < b.release_date)
    {
      return 1;
    }
    else
    {
      return -1
    } 

  })
  for (const set of orderedSets) {
    console.table(`${set.name} - ${set.release_date}`);
  }

  //   const base  = "https://www.optcgapi.com/api/"
  //   console.log('fetching sets...')
  //   const setsRequest = await fetch(`${base}allSets/`)
  //   const sets = await setsRequest.json()

  //   const { error: setError } = await supabase.from('card_set').upsert(sets);
  // if (setError) throw new Error(`Operation Failed: ${setError.message}`);
  // console.log(`✅ Saved ${sets.length} Sets.`);

  //   const cardsRequest = await fetch(`${base}allSetCards/`)
  //   const cards = await cardsRequest.json()
  //   formattedCards = cards.map((card) => {
  //       return {
  //           card_id: card.card_set_id,
  //           name: card.card_name,
  //           set_id: card.set_id,
  //           card_number: card.card_number,
  //           rarity: card.rarity,
  //           cost: card.card_cost,
  //           power: card.card_power,
  //           type: card.card_type,
  //           colour: card.card_colour,
  //           attribute: card.card_attribute,
  //           effect: card.card_text,
  //           image_url: card.image_url,
  //           image_id: card.image_id,
  //           variations: card.variations,
  //           language: card.language,
  //           price: card.
  //       }
  //       })
  //       const { error: cardError } = await supabase.from('cards').upsert(cards);
  // if (cardError) throw new Error(`Operation Failed: ${cardError.message}`);
  // console.log(`✅ Saved ${cards.length} Cards.`);
}
seed();
