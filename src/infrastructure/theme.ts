import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './supabase/types'

export type WallTheme = Database['prayer_wall']['Tables']['wall_theme']['Row']

export const THEME_DEFAULTS: Omit<WallTheme, 'id' | 'wall_id' | 'updated_at'> = {
  wall_title:         'Prayer Foundation',
  color_primary:      '#5e061e',
  color_heading:      '#242148',
  color_muted:        '#88838a',
  color_background:   '#d7c39d',
  font_heading:       'serif',
  font_body:          'sans-serif',
  // Header section
  color_header_bg:    '#ffffff',
  color_header_text:  '#242148',
  font_header:        'serif',
  // Banner section
  color_banner_bg:    '#ffffff',
  color_banner_text:  '#342f31',
  font_banner:        'sans-serif',
  // Wall section
  color_wall_bg:      '#d7c39d',
  color_wall_text:    '#342f31',
  font_wall:          'sans-serif',
  // Modal (pop-up) section
  color_modal_bg:     '#1c1917',
  color_modal_text:   '#f5f5f4',
  color_modal_accent: '#d97706',
  font_modal:         'sans-serif',
  // Brick layout
  stones_per_row:  5,
  brick_scale:     1.00,
  brick_aspect:    0.50,
  brick_overlap_x: 149,
  brick_overlap_y: 67,
  // Brick name styling
  brick_name_y:     50,
  brick_name_font:  "'Libre Baskerville', Georgia, serif",
  brick_name_size:  1.0,
  brick_name_color: '#000000',
}

const LS_KEY = 'prayer-wall:theme'

export function applyTheme(theme: Partial<typeof THEME_DEFAULTS>) {
  const t = { ...THEME_DEFAULTS, ...theme }
  const root = document.documentElement
  // Global
  root.style.setProperty('--color-primary',      t.color_primary)
  root.style.setProperty('--color-heading',       t.color_heading)
  root.style.setProperty('--color-muted',         t.color_muted)
  root.style.setProperty('--color-background',    t.color_background)
  root.style.setProperty('--font-heading',        t.font_heading)
  root.style.setProperty('--font-body',           t.font_body)
  root.style.setProperty('--wall-title',          t.wall_title)
  // Header
  root.style.setProperty('--color-header-bg',     t.color_header_bg)
  root.style.setProperty('--color-header-text',   t.color_header_text)
  root.style.setProperty('--font-header',         t.font_header)
  // Banner
  root.style.setProperty('--color-banner-bg',     t.color_banner_bg)
  root.style.setProperty('--color-banner-text',   t.color_banner_text)
  root.style.setProperty('--font-banner',         t.font_banner)
  // Wall
  root.style.setProperty('--color-wall-bg',       t.color_wall_bg)
  root.style.setProperty('--color-wall-text',     t.color_wall_text)
  root.style.setProperty('--font-wall',           t.font_wall)
  // Modal
  root.style.setProperty('--color-modal-bg',      t.color_modal_bg)
  root.style.setProperty('--color-modal-text',    t.color_modal_text)
  root.style.setProperty('--color-modal-accent',  t.color_modal_accent)
  root.style.setProperty('--font-modal',          t.font_modal)
  // Brick layout — compute stone dimensions in JS so stones_per_row can vary
  const n      = Math.max(1, t.stones_per_row)
  const scale  = Math.max(0.25, t.brick_scale)
  const aspect = Math.max(0.2, t.brick_aspect)
  const ovx    = Math.round(t.brick_overlap_x * scale)
  const ovy    = Math.round(t.brick_overlap_y * scale)
  const padding = 20
  // Base stone width: fills viewport with n stones given the overlap, clamped between 80px–600px
  const minW = Math.round(80  * scale)
  const maxW = Math.round(600 * scale)
  const vw   = typeof window !== 'undefined' ? window.innerWidth : 1024
  const rawW = Math.round((vw - padding * 2 + ovx * (n - 1)) / n)
  const stoneW = Math.min(maxW, Math.max(minW, rawW))
  const stoneH = Math.round(stoneW * aspect)
  root.style.setProperty('--stone-w',         `${stoneW}px`)
  root.style.setProperty('--stone-h',         `${stoneH}px`)
  root.style.setProperty('--stone-overlap-x', `${ovx}px`)
  root.style.setProperty('--stone-overlap-y', `${ovy}px`)
  root.style.setProperty('--stones-per-row',  String(n))
  // Brick name styling
  root.style.setProperty('--brick-name-font',  t.brick_name_font)
  root.style.setProperty('--brick-name-size',  String(t.brick_name_size))
  root.style.setProperty('--brick-name-color', t.brick_name_color)
  root.style.setProperty('--brick-name-y',     String(t.brick_name_y))
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
