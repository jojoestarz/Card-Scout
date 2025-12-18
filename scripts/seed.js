import { createClient } from 'npm:@supabase/supabase-js'
import cards from '../data/cards.json' assert { type: 'json' }


console.log(cards)

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_KEY,
)


