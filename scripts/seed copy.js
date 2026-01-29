const { JustTCG } = require('justtcg-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// ------------------------------------------------------------------
// Client Setup
// ------------------------------------------------------------------
const apiKey = process.env.JUSTTCG_API_KEY || process.env.TCG_API_KEY;

if (!apiKey) throw new Error("Missing JUSTTCG_API_KEY or TCG_API_KEY in environment variables");
const client = new JustTCG({ apiKey });

const supabase = createClient('https://ynhdlnqtzbolovuaxcqx.supabase.co', process.env.SUPABASE_SERVICE_KEY);

// ------------------------------------------------------------------
// Utilities
// ------------------------------------------------------------------
//TODO:  Fetch & Upsert Sets:


//TODO: Fetch & Upsert Cards(Check for dupe images):
