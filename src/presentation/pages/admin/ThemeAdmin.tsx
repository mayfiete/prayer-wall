import { useState, useEffect } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../../infrastructure/supabase/types'
import { applyTheme, cacheTheme, THEME_DEFAULTS } from '../../../infrastructure/theme'
import { Save, CheckCircle, RefreshCw } from 'lucide-react'

const WALL_ID = (import.meta.env.VITE_WALL_ID as string | undefined)?.trim() ?? ''

const HEADING_FONTS = [
  { value: 'serif',                        label: 'Serif (classic)' },
  { value: "'Libre Baskerville', serif",   label: 'Libre Baskerville' },
  { value: 'Georgia, serif',               label: 'Georgia' },
  { value: 'sans-serif',                   label: 'Sans-serif (modern)' },
  { value: "'Poppins', sans-serif",        label: 'Poppins' },
]

const BODY_FONTS = [
  { value: "'Poppins', sans-serif",        label: 'Poppins (default)' },
  { value: 'sans-serif',                   label: 'System sans-serif' },
  { value: 'Georgia, serif',               label: 'Georgia' },
  { value: "'Libre Baskerville', serif",   label: 'Libre Baskerville' },
]

interface ThemeAdminProps {
  supabase: SupabaseClient<Database>
}

type ThemeRow = Database['prayer_wall']['Tables']['wall_theme']['Row']

type DraftTheme = Omit<ThemeRow, 'id' | 'wall_id' | 'updated_at'>

const DEFAULTS: DraftTheme = {
  wall_title:       THEME_DEFAULTS.wall_title,
  color_primary:    THEME_DEFAULTS.color_primary,
  color_heading:    THEME_DEFAULTS.color_heading,
  color_muted:      THEME_DEFAULTS.color_muted,
  color_background: THEME_DEFAULTS.color_background,
  font_heading:     THEME_DEFAULTS.font_heading,
  font_body:        THEME_DEFAULTS.font_body,
}

export function ThemeAdmin({ supabase }: ThemeAdminProps) {
  const [draft, setDraft] = useState<DraftTheme>(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!WALL_ID) { setLoading(false); return }
    supabase.from('wall_theme').select('*').eq('wall_id', WALL_ID).maybeSingle()
      .then(({ data }) => {
        const row = data as ThemeRow | null
        if (row) {
          setDraft({
            wall_title:       row.wall_title,
            color_primary:    row.color_primary,
            color_heading:    row.color_heading,
            color_muted:      row.color_muted,
            color_background: row.color_background,
            font_heading:     row.font_heading,
            font_body:        row.font_body,
          })
        }
        setLoading(false)
      })
  }, [supabase])

  function update<K extends keyof DraftTheme>(key: K, value: DraftTheme[K]) {
    setDraft(prev => ({ ...prev, [key]: value }))
    setSaved(false)
    applyTheme({ ...draft, [key]: value })
  }

  async function handleSave() {
    if (!WALL_ID) { setError('VITE_WALL_ID is not set'); return }
    setSaving(true)
    setError('')
    const { error: upsertError } = await supabase.from('wall_theme').upsert(
      { wall_id: WALL_ID, ...draft },
      { onConflict: 'wall_id' },
    )
    setSaving(false)
    if (upsertError) { setError(upsertError.message); return }
    cacheTheme(draft)
    setSaved(true)
  }

  function handleReset() {
    setDraft(DEFAULTS)
    applyTheme(DEFAULTS)
    setSaved(false)
  }

  if (loading) return <p className="text-stone-400 text-sm py-8 text-center">Loading theme…</p>

  return (
    <div className="max-w-xl mx-auto space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-[var(--color-heading)]">Theme</h2>
        <p className="text-xs text-stone-400 mt-0.5">Changes preview live. Click Save to persist.</p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Wall title */}
      <section className="bg-white border border-stone-200 rounded-lg px-5 py-5 space-y-4">
        <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Identity</h3>
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Wall title</label>
          <input
            type="text"
            value={draft.wall_title}
            onChange={e => update('wall_title', e.target.value)}
            className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40"
          />
          <p className="text-xs text-stone-400 mt-1">Displayed as the main heading on the prayer wall.</p>
        </div>
      </section>

      {/* Colors */}
      <section className="bg-white border border-stone-200 rounded-lg px-5 py-5 space-y-4">
        <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Colors</h3>

        <ColorRow
          label="Primary"
          description="Buttons, active tabs, toggles, accents"
          value={draft.color_primary}
          onChange={v => update('color_primary', v)}
        />
        <ColorRow
          label="Heading"
          description="Main titles and headings"
          value={draft.color_heading}
          onChange={v => update('color_heading', v)}
        />
        <ColorRow
          label="Muted"
          description="Secondary labels and subtext"
          value={draft.color_muted}
          onChange={v => update('color_muted', v)}
        />
        <ColorRow
          label="Wall background"
          description="Background of the stone wall section"
          value={draft.color_background}
          onChange={v => update('color_background', v)}
        />
      </section>

      {/* Typography */}
      <section className="bg-white border border-stone-200 rounded-lg px-5 py-5 space-y-4">
        <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Typography</h3>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Heading font</label>
          <select
            value={draft.font_heading}
            onChange={e => update('font_heading', e.target.value)}
            className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40"
            style={{ fontFamily: draft.font_heading }}
          >
            {HEADING_FONTS.map(f => (
              <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>{f.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Body font</label>
          <select
            value={draft.font_body}
            onChange={e => update('font_body', e.target.value)}
            className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40"
            style={{ fontFamily: draft.font_body }}
          >
            {BODY_FONTS.map(f => (
              <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>{f.label}</option>
            ))}
          </select>
        </div>
      </section>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 text-sm text-stone-400 hover:text-stone-700 transition-colors"
        >
          <RefreshCw size={13} />
          Reset to defaults
        </button>

        <div className="flex items-center gap-4">
          {saved && (
            <span className="flex items-center gap-1.5 text-sm text-emerald-600">
              <CheckCircle size={15} />
              Theme saved
            </span>
          )}
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-[var(--color-primary)] text-white rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-60 transition-colors"
          >
            <Save size={14} />
            {saving ? 'Saving…' : 'Save Theme'}
          </button>
        </div>
      </div>
    </div>
  )
}

interface ColorRowProps {
  label: string
  description: string
  value: string
  onChange: (v: string) => void
}

function ColorRow({ label, description, value, onChange }: ColorRowProps) {
  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0">
        <input
          type="color"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-10 h-10 rounded-md border border-stone-200 cursor-pointer p-0.5 bg-white"
          title={label}
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-stone-800">{label}</p>
        <p className="text-xs text-stone-400">{description}</p>
      </div>
      <input
        type="text"
        value={value}
        onChange={e => {
          if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) onChange(e.target.value)
        }}
        maxLength={7}
        className="w-24 border border-stone-300 rounded-md px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40"
      />
    </div>
  )
}
