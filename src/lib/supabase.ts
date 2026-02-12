import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || "https://ynhdlnqtzbolovuaxcqx.supabase.co"
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY

if (!SUPABASE_KEY) {
  console.warn("⚠️  Missing EXPO_PUBLIC_SUPABASE_KEY")
}

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_KEY as string,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
)