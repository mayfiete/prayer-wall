import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

export function createSupabaseClient() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. ' +
        'Set VITE_USE_MOCK=true to run without Supabase.',
    )
  }

  return createClient<Database>(supabaseUrl, supabaseAnonKey)
}
