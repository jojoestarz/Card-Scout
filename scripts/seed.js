import { createClient } from '@supabase/supabase-js'
import cards from './cards.json' with { type: 'json' }
import 'dotenv/config' 

const SUPABASE_URL = "https://ynhdlnqtzbolovuaxcqx.supabase.co"

const supabase = createClient(
 SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)


async function seed() {

    for (const card of cards) {
        const { data, error } = await supabase
            .from('cards')
            .insert(card)
            .select();

        if (error) {
            console.error('Error inserting data:', error);
        } else {
            console.log('Data inserted successfully:', data[0].name);
        }
    }

}

seed();