/**
 * Tests for cardService.SearchCards()
 * 
 * These tests verify that the search filters work correctly:
 * - searchTerm: case-insensitive name search
 * - colour: exact colour match
 * - card_id: exact card ID match
 * - card_type, attribute, rarity, set_id, leadersOnly: detail filters
 * - limit: pagination limit
 * - offset: pagination offset
 * 
 * Run with: npx tsx src/services/cardService.test.ts
 */

// Load environment variables FIRST before any imports
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

// Now import cardService AFTER env vars are loaded
import { cardService } from "./cardService";
import type { Card } from "../types/card";



// Test utilities
interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTest(name: string, testFn: () => Promise<void>) {
  try {
    console.log(`\n Running: ${name}`);
    await testFn();
    results.push({ name, passed: true });
    console.log(` PASSED: ${name}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    results.push({ name, passed: false, error: errorMessage });
    console.error(` FAILED: ${name}`);
    console.error(`   Error: ${errorMessage}`);
  }
}

// ============================================================================
// TEST: searchTerm filter (case-insensitive name search)
// ============================================================================
await runTest("SearchCards with searchTerm should return matching cards", async () => {
  const { data } = await cardService.SearchCards({ 
    searchTerm: "Luffy",
    limit: 50 
  });
  
  assert(Array.isArray(data), "Should return an array");
  assert(data.length > 0, "Should find at least one card with 'Luffy' in the name");
  
  // Verify all returned cards contain 'Luffy' in name (case-insensitive)
  data.forEach((card: Card) => {
    assert(
      card.name.toLowerCase().includes("luffy"),
      `Card "${card.name}" should contain "luffy"`
    );
  });
  
  console.log(`   Found ${data.length} cards with "Luffy" in name`);
});

// ============================================================================
// TEST: searchTerm case-insensitivity
// ============================================================================
await runTest("SearchCards should be case-insensitive", async () => {
  const { data: lowercase } = await cardService.SearchCards({ 
    searchTerm: "luffy",
    limit: 10 
  });
  
  const { data: uppercase } = await cardService.SearchCards({ 
    searchTerm: "LUFFY",
    limit: 10 
  });
  
  const { data: mixedcase } = await cardService.SearchCards({ 
    searchTerm: "LuFfY",
    limit: 10 
  });
  
  assert(lowercase.length > 0, "Lowercase search should return results");
  assert(
    lowercase.length === uppercase.length && uppercase.length === mixedcase.length,
    `All case variations should return same count (got ${lowercase.length}, ${uppercase.length}, ${mixedcase.length})`
  );
  
  console.log(`   All case variations returned ${lowercase.length} results`);
});

// ============================================================================
// TEST: colour filter
// ============================================================================
await runTest("SearchCards with colour filter should return only matching colour", async () => {
  const targetColour = "Red";
  const { data } = await cardService.SearchCards({ 
    colour: targetColour,
    limit: 30 
  });
  
  assert(Array.isArray(data), "Should return an array");
  assert(data.length > 0, `Should find at least one ${targetColour} card`);
  
  // Verify all returned cards have the correct colour
  data.forEach((card: Card) => {
    assert(
      card.colour === targetColour,
      `Card "${card.name}" colour should be "${targetColour}", got "${card.colour}"`
    );
  });
  
  console.log(`   Found ${data.length} ${targetColour} cards`);
});

// ============================================================================
// TEST: Combined filters (searchTerm + colour)
// ============================================================================
await runTest("SearchCards with combined searchTerm and colour filters", async () => {
  const searchTerm = "Luffy";
  const colour = "Red";
  
  const { data } = await cardService.SearchCards({ 
    searchTerm,
    colour,
    limit: 30 
  });
  
  assert(Array.isArray(data), "Should return an array");
  
  if (data.length > 0) {
    // Verify all cards match both filters
    data.forEach((card: Card) => {
      assert(
        card.name.toLowerCase().includes(searchTerm.toLowerCase()),
        `Card "${card.name}" should contain "${searchTerm}"`
      );
      assert(
        card.colour === colour,
        `Card "${card.name}" should be ${colour}, got ${card.colour}`
      );
    });
    console.log(`   Found ${data.length} ${colour} cards with "${searchTerm}" in name`);
  } else {
    console.log(`   No results (valid if no ${colour} "${searchTerm}" cards exist)`);
  }
});

// ============================================================================
// TEST: card_id filter (exact match)
// ============================================================================
await runTest("SearchCards with card_id should return exact card", async () => {
  const targetCardId = "OP01-001";
  const { data } = await cardService.SearchCards({ 
    card_id: targetCardId 
  });
  
  assert(Array.isArray(data), "Should return an array");
  
  if (data.length > 0) {
    assert(data.length === 1, `Should return exactly 1 card, got ${data.length}`);
    assert(
      data[0].card_id === targetCardId,
      `Card ID should be "${targetCardId}", got "${data[0].card_id}"`
    );
    console.log(`   Found card: ${data[0].name} (${data[0].card_id})`);
  } else {
    console.log(`   No card found with ID ${targetCardId} (may not exist in DB)`);
  }
});

// ============================================================================
// TEST: Pagination - limit
// ============================================================================
await runTest("SearchCards should respect limit parameter", async () => {
  const limit = 5;
  const { data } = await cardService.SearchCards({ 
    limit 
  });
  
  assert(Array.isArray(data), "Should return an array");
  assert(
    data.length <= limit,
    `Should return at most ${limit} cards, got ${data.length}`
  );
  assert(
    data.length > 0,
    "Should return at least some cards"
  );
  
  console.log(`   Returned ${data.length} cards (limit: ${limit})`);
});

// ============================================================================
// TEST: Pagination - offset
// ============================================================================
await runTest("SearchCards should respect offset parameter", async () => {
  // Get first page
  const { data: firstPage } = await cardService.SearchCards({ 
    limit: 10,
    offset: 0 
  });
  
  // Get second page
  const { data: secondPage } = await cardService.SearchCards({ 
    limit: 10,
    offset: 10 
  });
  
  assert(firstPage.length > 0, "First page should have results");
  assert(secondPage.length > 0, "Second page should have results");
  
  // Verify pages don't overlap (no duplicate card_ids)
  const firstPageIds = new Set(firstPage.map(c => c.card_id));
  const secondPageIds = new Set(secondPage.map(c => c.card_id));
  
  const overlap = [...firstPageIds].filter(id => secondPageIds.has(id));
  assert(
    overlap.length === 0,
    `Pages should not overlap, found ${overlap.length} duplicates: ${overlap.join(", ")}`
  );
  
  console.log(`   First page: ${firstPage.length} cards, Second page: ${secondPage.length} cards (no overlap)`);
});

// ============================================================================
// TEST: Pagination - consistent ordering
// ============================================================================
await runTest("SearchCards pagination should return consistent results", async () => {
  // Fetch two separate requests with same parameters
  const { data: request1 } = await cardService.SearchCards({ 
    searchTerm: "Monkey",
    limit: 10 
  });
  
  const { data: request2 } = await cardService.SearchCards({ 
    searchTerm: "Monkey",
    limit: 10 
  });
  
  if (request1.length > 0) {
    assert(
      request1.length === request2.length,
      `Both requests should return same count, got ${request1.length} and ${request2.length}`
    );
    
    // Verify same cards in same order
    for (let i = 0; i < request1.length; i++) {
      assert(
        request1[i].card_id === request2[i].card_id,
        `Card at index ${i} should match: expected ${request1[i].card_id}, got ${request2[i].card_id}`
      );
    }
    console.log(`   Both requests returned identical ${request1.length} cards in same order`);
  } else {
    console.log(`   No results for "Monkey" search (valid if no such cards exist)`);
  }
});

// ============================================================================
// TEST: Empty filters (should return default cards)
// ============================================================================
await runTest("SearchCards with no filters should return default results", async () => {
  const { data } = await cardService.SearchCards({});
  
  assert(Array.isArray(data), "Should return an array");
  assert(data.length > 0, "Should return some cards");
  assert(data.length <= 20, "Should respect default limit of 20");
  
  console.log(`   Returned ${data.length} cards with default parameters`);
});

// ============================================================================
// TEST: Non-existent searchTerm
// ============================================================================
await runTest("SearchCards with non-existent searchTerm should return empty array", async () => {
  const { data } = await cardService.SearchCards({ 
    searchTerm: "XYZNONEXISTENT123456789" 
  });
  
  assert(Array.isArray(data), "Should return an array");
  assert(data.length === 0, `Should return empty array, got ${data.length} results`);
  
  console.log(`   Correctly returned 0 results for non-existent search term`);
});

// ============================================================================
// TEST: Invalid colour filter
// ============================================================================
await runTest("SearchCards with invalid colour should return empty array", async () => {
  const { data } = await cardService.SearchCards({ 
    colour: "InvalidColourThatDoesNotExist" 
  });
  
  assert(Array.isArray(data), "Should return an array");
  assert(data.length === 0, `Should return empty array, got ${data.length} results`);
  
  console.log(`   Correctly returned 0 results for invalid colour`);
});

// ============================================================================
// TEST: Partial name match
// ============================================================================
await runTest("SearchCards should support partial name matching", async () => {
  const { data } = await cardService.SearchCards({ 
    searchTerm: "Mon",  // Should match "Monkey", "Monster", etc.
    limit: 20 
  });
  
  assert(Array.isArray(data), "Should return an array");
  
  if (data.length > 0) {
    data.forEach((card: Card) => {
      assert(
        card.name.toLowerCase().includes("mon"),
        `Card "${card.name}" should contain "mon"`
      );
    });
    console.log(`   Found ${data.length} cards with "Mon" in name`);
  } else {
    console.log(`   No results for partial match "Mon" (database may not have matching cards)`);
  }
});

// ============================================================================
// TEST: All colour options
// ============================================================================
await runTest("SearchCards should work with all valid colours", async () => {
  const colours = ["Red", "Blue", "Green", "Purple", "Black", "Yellow"];
  const colourResults: Record<string, number> = {};
  
  for (const colour of colours) {
    const { data } = await cardService.SearchCards({ 
      colour,
      limit: 5 
    });
    colourResults[colour] = data.length;
    
    // Verify returned cards match the colour
    data.forEach((card: Card) => {
      assert(
        card.colour === colour,
        `Card "${card.name}" should be ${colour}, got ${card.colour}`
      );
    });
  }
  
  console.log(`   Colour results:`, colourResults);
  
  // At least some colours should have cards
  const totalCards = Object.values(colourResults).reduce((sum, count) => sum + count, 0);
  assert(totalCards > 0, "At least one colour should have cards in the database");
});

// ============================================================================
// TEST: card_id pattern search via searchTerm (exact match, e.g. OP05-060)
// ============================================================================
await runTest("SearchCards with card ID pattern should exact-match by card_id", async () => {
  const targetCardId = "OP05-060";
  const { data } = await cardService.SearchCards({
    searchTerm: targetCardId,
    limit: 10,
  });

  assert(Array.isArray(data), "Should return an array");

  if (data.length > 0) {
    assert(
      data.length === 1,
      `Exact card ID search should return 1 card, got ${data.length}`,
    );
    assert(
      data[0].card_id === targetCardId,
      `Should find card with ID ${targetCardId}, got ${data[0].card_id}`,
    );
    console.log(`   Found card: ${data[0].name} (${data[0].card_id})`);
  } else {
    console.log(
      `   No card found with ID ${targetCardId} (may not exist in DB yet — run seed after migration)`,
    );
  }
});

// ============================================================================
// TEST: leadersOnly filter
// ============================================================================
await runTest("SearchCards with leadersOnly should return only Leader cards", async () => {
  const { data } = await cardService.SearchCards({
    leadersOnly: true,
    limit: 30,
  });

  assert(Array.isArray(data), "Should return an array");

  if (data.length > 0) {
    data.forEach((card: Card) => {
      assert(
        card.card_type === "Leader",
        `Card "${card.name}" should be Leader, got "${card.card_type}"`,
      );
    });
    console.log(`   Found ${data.length} Leader cards`);
  } else {
    console.log(`   No Leader cards found (database may be empty)`);
  }
});

// ============================================================================
// TEST: card_type filter
// ============================================================================
await runTest("SearchCards with card_type filter should return matching type", async () => {
  const targetType = "Character";
  const { data } = await cardService.SearchCards({
    card_type: targetType,
    limit: 30,
  });

  assert(Array.isArray(data), "Should return an array");

  if (data.length > 0) {
    data.forEach((card: Card) => {
      assert(
        card.card_type === targetType,
        `Card "${card.name}" should be ${targetType}, got "${card.card_type}"`,
      );
    });
    console.log(`   Found ${data.length} ${targetType} cards`);
  } else {
    console.log(`   No ${targetType} cards found`);
  }
});

// ============================================================================
// TEST: attribute filter
// ============================================================================
await runTest("SearchCards with attribute filter should return matching attribute", async () => {
  const targetAttribute = "Strike";
  const { data } = await cardService.SearchCards({
    attribute: targetAttribute,
    limit: 30,
  });

  assert(Array.isArray(data), "Should return an array");

  if (data.length > 0) {
    data.forEach((card: Card) => {
      assert(
        card.attribute === targetAttribute,
        `Card "${card.name}" attribute should be "${targetAttribute}", got "${card.attribute}"`,
      );
    });
    console.log(`   Found ${data.length} ${targetAttribute} cards`);
  } else {
    console.log(`   No ${targetAttribute} cards found`);
  }
});

// ============================================================================
// TEST: rarity filter
// ============================================================================
await runTest("SearchCards with rarity filter should return matching rarity", async () => {
  const targetRarity = "SR";
  const { data } = await cardService.SearchCards({
    rarity: targetRarity,
    limit: 30,
  });

  assert(Array.isArray(data), "Should return an array");

  if (data.length > 0) {
    data.forEach((card: Card) => {
      assert(
        card.rarity === targetRarity,
        `Card "${card.name}" rarity should be "${targetRarity}", got "${card.rarity}"`,
      );
    });
    console.log(`   Found ${data.length} ${targetRarity} cards`);
  } else {
    console.log(`   No ${targetRarity} cards found`);
  }
});

// ============================================================================
// TEST: set_id filter
// ============================================================================
await runTest("SearchCards with set_id filter should return matching set", async () => {
  const targetSet = "OP05";
  const { data } = await cardService.SearchCards({
    set_id: targetSet,
    limit: 30,
  });

  assert(Array.isArray(data), "Should return an array");

  if (data.length > 0) {
    data.forEach((card: Card) => {
      assert(
        card.set_id === targetSet,
        `Card "${card.name}" set should be "${targetSet}", got "${card.set_id}"`,
      );
    });
    console.log(`   Found ${data.length} cards from ${targetSet}`);
  } else {
    console.log(`   No cards found for set ${targetSet}`);
  }
});

// ============================================================================
// TEST: Combined filters (searchTerm + colour + card_type)
// ============================================================================
await runTest("SearchCards with multiple detail filters combined", async () => {
  const { data } = await cardService.SearchCards({
    colour: "Red",
    card_type: "Character",
    limit: 30,
  });

  assert(Array.isArray(data), "Should return an array");

  if (data.length > 0) {
    data.forEach((card: Card) => {
      assert(card.colour === "Red", `Card "${card.name}" should be Red`);
      assert(
        card.card_type === "Character",
        `Card "${card.name}" should be Character`,
      );
    });
    console.log(`   Found ${data.length} Red Character cards`);
  } else {
    console.log(`   No Red Character cards found (valid if none exist)`);
  }
});

// ============================================================================
// TEST: getCardWithVariations returns multiple printings for parallel cards
// ============================================================================
await runTest("getCardWithVariations should return variations for parallel card", async () => {
  const targetCardId = "OP05-060";
  const card = await cardService.getCardWithVariations(targetCardId);

  if (!card) {
    console.log(
      `   Card ${targetCardId} not found (may not exist in DB yet — run seed after migration)`,
    );
    return;
  }

  assert(card.card_id === targetCardId, `Expected card_id ${targetCardId}`);
  assert(Array.isArray(card.variations), "Should include variations array");
  assert(
    card.variations!.length >= 1,
    "Should have at least one variation row",
  );

  const printings = card.variations!.map((v) => v.printing);
  console.log(`   Variations (${printings.length}): ${printings.join(", ")}`);

  if (card.variations!.length >= 2) {
    assert(
      printings.includes("normal") || printings.includes("parallel"),
      "Parallel card should include normal and/or parallel printings",
    );
  }
});

// ============================================================================
// TEST: getVariationById
// ============================================================================
await runTest("getVariationById should fetch a single variation", async () => {
  const variationsId = "OP05-060:normal";
  const variation = await cardService.getVariationById(variationsId);

  if (!variation) {
    console.log(
      `   Variation ${variationsId} not found (may not exist in DB yet — run seed after migration)`,
    );
    return;
  }

  assert(
    variation.variations_id === variationsId,
    `Expected variations_id ${variationsId}`,
  );
  assert(variation.card_id === "OP05-060", "Variation should belong to OP05-060");
  console.log(`   Found variation: ${variation.printing} (${variation.variations_id})`);
});

// ============================================================================
// SUMMARY
// ============================================================================
console.log("\n" + "=".repeat(80));
console.log("TEST SUMMARY");
console.log("=".repeat(80));

const passed = results.filter(r => r.passed).length;
const failed = results.filter(r => !r.passed).length;

console.log(`\nTotal Tests: ${results.length}`);
console.log(` Passed: ${passed}`);
console.log(` Failed: ${failed}`);

if (failed > 0) {
  console.log("\nFailed Tests:");
  results.filter(r => !r.passed).forEach(r => {
    console.log(`   ${r.name}`);
    console.log(`     ${r.error}`);
  });
}

console.log("\n" + "=".repeat(80));

// Exit with appropriate code
process.exit(failed > 0 ? 1 : 0);
