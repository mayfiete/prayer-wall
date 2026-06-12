import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './supabase/types'

export type WallTheme = Database['prayer_wall']['Tables']['wall_theme']['Row']

export const THEME_DEFAULTS: Omit<WallTheme, 'id' | 'wall_id' | 'updated_at'> = {
  wall_title:       'Prayer Foundation',
  color_primary:    '#5e061e',
  color_heading:    '#242148',
  color_muted:      '#88838a',
  color_background: '#d7c39d',
  font_heading:     'serif',
  font_body:        'sans-serif',
}

const LS_KEY = 'prayer-wall:theme'

export function applyTheme(theme: Partial<typeof THEME_DEFAULTS>) {
  const t = { ...THEME_DEFAULTS, ...theme }
  const root = document.documentElement
  root.style.setProperty('--color-primary',    t.color_primary)
  root.style.setProperty('--color-heading',    t.color_heading)
  root.style.setProperty('--color-muted',      t.color_muted)
  root.style.setProperty('--color-background', t.color_background)
  root.style.setProperty('--font-heading',     t.font_heading)
  root.style.setProperty('--font-body',        t.font_body)
  root.style.setProperty('--wall-title',       t.wall_title)
}

export function loadCachedTheme() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) applyTheme(JSON.parse(raw) as Partial<typeof THEME_DEFAULTS>)
  } catch { /* ignore */ }
}

export function cacheTheme(theme: Partial<typeof THEME_DEFAULTS>) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(theme)) } catch { /* ignore */ }
}

export async function fetchAndApplyTheme(
  supabase: SupabaseClient<Database>,
  wallId: string,
) {
  const { data } = await supabase
    .from('wall_theme')
    .select('*')
    .eq('wall_id', wallId)
    .maybeSingle()

  if (data) {
    applyTheme(data)
    cacheTheme(data)
  }
}
