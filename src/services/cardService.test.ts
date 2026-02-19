/**
 * Tests for cardService.SearchCards()
 * 
 * These tests verify that the search filters work correctly:
 * - searchTerm: case-insensitive name search
 * - colour: exact colour match
 * - card_id: exact card ID match
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
