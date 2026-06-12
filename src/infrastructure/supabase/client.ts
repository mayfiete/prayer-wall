import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim()
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim()

if (!supabaseUrl || !supabaseAnonKey) {
  if (import.meta.env.VITE_USE_MOCK !== 'true') {
    console.warn(
      'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. ' +
        'Set VITE_USE_MOCK=true to run without Supabase.',
    )
  }
}

export const supabaseClient = (supabaseUrl && supabaseAnonKey)
  ? createClient<Database>(supabaseUrl, supabaseAnonKey, {
      db: { schema: 'prayer_wall' },
    })
  : null


export function createSupabaseClient() {
  if (!supabaseClient) {
    throw new Error(
      'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. ' +
        'Set VITE_USE_MOCK=true to run without Supabase.',
    )
  }
  return supabaseClient
}
