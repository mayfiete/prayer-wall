import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../supabase/types'

/** The database checks the JWT's user ID; no browser allowlist or email check. */
export async function canAccessAdmin(supabase: SupabaseClient<Database>): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('is_app_admin')
    return !error && data === true
  } catch {
    return false
  }
}
