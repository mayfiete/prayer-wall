import { useState, useEffect } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../../infrastructure/supabase/types'
import { applyTheme, cacheTheme, THEME_DEFAULTS } from '../../../infrastructure/theme'
import { Save, CheckCircle, RefreshCw } from 'lucide-react'

const WALL_ID = (import.meta.env.VITE_WALL_ID as string | undefined)?.trim() ?? ''

const ALL_FONTS = [
  { value: "'Poppins', sans-serif",        label: 'Poppins' },
  { value: 'sans-serif',                   label: 'System sans-serif' },
  { value: 'serif',                        label: 'Serif (classic)' },
  { value: 'Georgia, serif',               label: 'Georgia' },
  { value: "'Libre Baskerville', serif",   label: 'Libre Baskerville' },
]


interface ThemeAdminProps {
  supabase: SupabaseClient<Database>
}

type ThemeRow = Database['prayer_wall']['Tables']['wall_theme']['Row']

type DraftTheme = Omit<ThemeRow, 'id' | 'wall_id' | 'updated_at'>

const DEFAULTS: DraftTheme = {
  wall_title:         THEME_DEFAULTS.wall_title,
  color_primary:      THEME_DEFAULTS.color_primary,
  color_heading:      THEME_DEFAULTS.color_heading,
  color_muted:        THEME_DEFAULTS.color_muted,
  color_background:   THEME_DEFAULTS.color_background,
  font_heading:       THEME_DEFAULTS.font_heading,
  font_body:          THEME_DEFAULTS.font_body,
  color_header_bg:    THEME_DEFAULTS.color_header_bg,
  color_header_text:  THEME_DEFAULTS.color_header_text,
  font_header:        THEME_DEFAULTS.font_header,
  color_banner_bg:    THEME_DEFAULTS.color_banner_bg,
  color_banner_text:  THEME_DEFAULTS.color_banner_text,
  font_banner:        THEME_DEFAULTS.font_banner,
  color_wall_bg:      THEME_DEFAULTS.color_wall_bg,
  color_wall_text:    THEME_DEFAULTS.color_wall_text,
  font_wall:          THEME_DEFAULTS.font_wall,
  color_modal_bg:     THEME_DEFAULTS.color_modal_bg,
  color_modal_text:   THEME_DEFAULTS.color_modal_text,
  color_modal_accent: THEME_DEFAULTS.color_modal_accent,
  font_modal:         THEME_DEFAULTS.font_modal,
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
            wall_title:         row.wall_title,
            color_primary:      row.color_primary,
            color_heading:      row.color_heading,
            color_muted:        row.color_muted,
            color_background:   row.color_background,
            font_heading:       row.font_heading,
            font_body:          row.font_body,
            color_header_bg:    row.color_header_bg   ?? THEME_DEFAULTS.color_header_bg,
            color_header_text:  row.color_header_text ?? THEME_DEFAULTS.color_header_text,
            font_header:        row.font_header        ?? THEME_DEFAULTS.font_header,
            color_banner_bg:    row.color_banner_bg   ?? THEME_DEFAULTS.color_banner_bg,
            color_banner_text:  row.color_banner_text ?? THEME_DEFAULTS.color_banner_text,
            font_banner:        row.font_banner        ?? THEME_DEFAULTS.font_banner,
            color_wall_bg:      row.color_wall_bg      ?? THEME_DEFAULTS.color_wall_bg,
            color_wall_text:    row.color_wall_text    ?? THEME_DEFAULTS.color_wall_text,
            font_wall:          row.font_wall           ?? THEME_DEFAULTS.font_wall,
            color_modal_bg:     row.color_modal_bg     ?? THEME_DEFAULTS.color_modal_bg,
            color_modal_text:   row.color_modal_text   ?? THEME_DEFAULTS.color_modal_text,
            color_modal_accent: row.color_modal_accent ?? THEME_DEFAULTS.color_modal_accent,
            font_modal:         row.font_modal          ?? THEME_DEFAULTS.font_modal,
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

      {/* Global colors */}
      <section className="bg-white border border-stone-200 rounded-lg px-5 py-5 space-y-4">
        <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Global Colors</h3>

        <ColorRow
          label="Primary"
          description="Buttons, active tabs, toggles, accents"
          value={draft.color_primary}
          onChange={v => update('color_primary', v)}
        />
        <ColorRow
          label="Heading"
          description="Default heading text color"
          value={draft.color_heading}
          onChange={v => update('color_heading', v)}
        />
        <ColorRow
          label="Muted"
          description="Secondary labels and subtext"
          value={draft.color_muted}
          onChange={v => update('color_muted', v)}
        />
      </section>

      {/* Global typography */}
      <section className="bg-white border border-stone-200 rounded-lg px-5 py-5 space-y-4">
        <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Global Typography</h3>

        <FontRow
          label="Heading font"
          value={draft.font_heading}
          onChange={v => update('font_heading', v)}
        />
        <FontRow
          label="Body font"
          value={draft.font_body}
          onChange={v => update('font_body', v)}
        />
      </section>

      {/* Header section */}
      <section className="bg-white border border-stone-200 rounded-lg px-5 py-5 space-y-4">
        <div>
          <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Header Section</h3>
          <p className="text-xs text-stone-400 mt-0.5">The top bar with the wall title and org name.</p>
        </div>
        <ColorRow
          label="Background"
          description="Header bar background"
          value={draft.color_header_bg}
          onChange={v => update('color_header_bg', v)}
        />
        <ColorRow
          label="Text"
          description="Title and org name color"
          value={draft.color_header_text}
          onChange={v => update('color_header_text', v)}
        />
        <FontRow
          label="Font"
          value={draft.font_header}
          onChange={v => update('font_header', v)}
        />
      </section>

      {/* Banner section */}
      <section className="bg-white border border-stone-200 rounded-lg px-5 py-5 space-y-4">
        <div>
          <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Banner Section</h3>
          <p className="text-xs text-stone-400 mt-0.5">The strip beneath the header with the call-to-action text.</p>
        </div>
        <ColorRow
          label="Background"
          description="Banner strip background"
          value={draft.color_banner_bg}
          onChange={v => update('color_banner_bg', v)}
        />
        <ColorRow
          label="Text"
          description="Banner text color"
          value={draft.color_banner_text}
          onChange={v => update('color_banner_text', v)}
        />
        <FontRow
          label="Font"
          value={draft.font_banner}
          onChange={v => update('font_banner', v)}
        />
      </section>

      {/* Wall section */}
      <section className="bg-white border border-stone-200 rounded-lg px-5 py-5 space-y-4">
        <div>
          <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Wall Section</h3>
          <p className="text-xs text-stone-400 mt-0.5">The stone grid area where bricklayers appear.</p>
        </div>
        <ColorRow
          label="Background"
          description="Stone wall background color"
          value={draft.color_wall_bg}
          onChange={v => update('color_wall_bg', v)}
        />
        <ColorRow
          label="Text"
          description="Labels and text within the wall section"
          value={draft.color_wall_text}
          onChange={v => update('color_wall_text', v)}
        />
        <FontRow
          label="Font"
          value={draft.font_wall}
          onChange={v => update('font_wall', v)}
        />
      </section>

      {/* Modal (pop-up) section */}
      <section className="bg-white border border-stone-200 rounded-lg px-5 py-5 space-y-4">
        <div>
          <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Pop-up (Modal)</h3>
          <p className="text-xs text-stone-400 mt-0.5">The "Commit to pray" dialog that opens when a bricklayer adds their stone.</p>
        </div>
        <ColorRow
          label="Background"
          description="Modal panel background"
          value={draft.color_modal_bg}
          onChange={v => update('color_modal_bg', v)}
        />
        <ColorRow
          label="Text"
          description="Body text, labels, and inputs"
          value={draft.color_modal_text}
          onChange={v => update('color_modal_text', v)}
        />
        <ColorRow
          label="Accent"
          description="Submit button and selection highlight color"
          value={draft.color_modal_accent}
          onChange={v => update('color_modal_accent', v)}
        />
        <FontRow
          label="Font"
          value={draft.font_modal}
          onChange={v => update('font_modal', v)}
        />
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

interface FontRowProps {
  label: string
  value: string
  onChange: (v: string) => void
}

function FontRow({ label, value, onChange }: FontRowProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-stone-700 mb-1">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40"
        style={{ fontFamily: value }}
      >
        {ALL_FONTS.map(f => (
          <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>{f.label}</option>
        ))}
      </select>
    </div>
  )
}
