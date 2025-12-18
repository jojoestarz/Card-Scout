
import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient, processLock } from '@supabase/supabase-js'
import 'dotenv/config'

const SUPABASE_URL = "https://ynhdlnqtzbolovuaxcqx.supabase.co"

export const supabase = createClient(
  SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_KEY,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      lock: processLock,
    },
    })

const {data, error} = await supabase.from('cards').select('*').limit(1)
console.log('Supabase connection test:', { data, error })
        