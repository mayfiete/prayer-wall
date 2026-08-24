import { useState, useEffect } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../../infrastructure/supabase/types'
import { applyTheme, cacheTheme, THEME_DEFAULTS } from '../../../infrastructure/theme'
import { Save, CheckCircle, RefreshCw, Loader2 } from 'lucide-react'

const ALL_FONTS = [
  { value: "'Poppins', sans-serif",        label: 'Poppins' },
  { value: 'sans-serif',                   label: 'System sans-serif' },
  { value: 'serif',                        label: 'Serif (classic)' },
  { value: 'Georgia, serif',               label: 'Georgia' },
  { value: "'Libre Baskerville', serif",   label: 'Libre Baskerville' },
]


interface ThemeAdminProps {
  supabase: SupabaseClient<Database>
  wallId: string
  onDone?: () => void
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
  color_header_bg:      THEME_DEFAULTS.color_header_bg,
  color_header_text:    THEME_DEFAULTS.color_header_text,
  color_header_subtext: THEME_DEFAULTS.color_header_subtext,
  font_header:          THEME_DEFAULTS.font_header,
  color_banner_bg:      THEME_DEFAULTS.color_banner_bg,
  color_banner_text:    THEME_DEFAULTS.color_banner_text,
  color_banner_subtext: THEME_DEFAULTS.color_banner_subtext,
  font_banner:          THEME_DEFAULTS.font_banner,
  color_wall_bg:      THEME_DEFAULTS.color_wall_bg,
  color_wall_text:    THEME_DEFAULTS.color_wall_text,
  font_wall:          THEME_DEFAULTS.font_wall,
  color_modal_bg:     THEME_DEFAULTS.color_modal_bg,
  color_modal_text:   THEME_DEFAULTS.color_modal_text,
  color_modal_accent: THEME_DEFAULTS.color_modal_accent,
  font_modal:         THEME_DEFAULTS.font_modal,
  stones_per_row:  THEME_DEFAULTS.stones_per_row,
  brick_scale:     THEME_DEFAULTS.brick_scale,
  brick_aspect:    THEME_DEFAULTS.brick_aspect,
  brick_overlap_x: THEME_DEFAULTS.brick_overlap_x,
  brick_overlap_y: THEME_DEFAULTS.brick_overlap_y,
  brick_name_y:        THEME_DEFAULTS.brick_name_y,
  brick_name_font:      THEME_DEFAULTS.brick_name_font,
  brick_name_size:      THEME_DEFAULTS.brick_name_size,
  brick_name_color:     THEME_DEFAULTS.brick_name_color,
  bible_translation:    THEME_DEFAULTS.bible_translation,
  text_banner_heading:  THEME_DEFAULTS.text_banner_heading,
  text_banner_body:     THEME_DEFAULTS.text_banner_body,
  text_wall_cta:        THEME_DEFAULTS.text_wall_cta,
  text_modal_title:     THEME_DEFAULTS.text_modal_title,
  text_success_heading: THEME_DEFAULTS.text_success_heading,
  text_success_body:    THEME_DEFAULTS.text_success_body,
  text_submit_button:   THEME_DEFAULTS.text_submit_button,
}

export function ThemeAdmin({ supabase, wallId: WALL_ID, onDone }: ThemeAdminProps) {
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
            color_header_bg:      row.color_header_bg      ?? THEME_DEFAULTS.color_header_bg,
            color_header_text:    row.color_header_text    ?? THEME_DEFAULTS.color_header_text,
            color_header_subtext: row.color_header_subtext ?? THEME_DEFAULTS.color_header_subtext,
            font_header:          row.font_header          ?? THEME_DEFAULTS.font_header,
            color_banner_bg:      row.color_banner_bg      ?? THEME_DEFAULTS.color_banner_bg,
            color_banner_text:    row.color_banner_text    ?? THEME_DEFAULTS.color_banner_text,
            color_banner_subtext: row.color_banner_subtext ?? THEME_DEFAULTS.color_banner_subtext,
            font_banner:          row.font_banner          ?? THEME_DEFAULTS.font_banner,
            color_wall_bg:      row.color_wall_bg      ?? THEME_DEFAULTS.color_wall_bg,
            color_wall_text:    row.color_wall_text    ?? THEME_DEFAULTS.color_wall_text,
            font_wall:          row.font_wall           ?? THEME_DEFAULTS.font_wall,
            color_modal_bg:     row.color_modal_bg     ?? THEME_DEFAULTS.color_modal_bg,
            color_modal_text:   row.color_modal_text   ?? THEME_DEFAULTS.color_modal_text,
            color_modal_accent: row.color_modal_accent ?? THEME_DEFAULTS.color_modal_accent,
            font_modal:         row.font_modal          ?? THEME_DEFAULTS.font_modal,
            stones_per_row:  row.stones_per_row  ?? THEME_DEFAULTS.stones_per_row,
            brick_scale:     row.brick_scale     ?? THEME_DEFAULTS.brick_scale,
            brick_aspect:    row.brick_aspect    ?? THEME_DEFAULTS.brick_aspect,
            brick_overlap_x: row.brick_overlap_x ?? THEME_DEFAULTS.brick_overlap_x,
            brick_overlap_y: row.brick_overlap_y ?? THEME_DEFAULTS.brick_overlap_y,
            brick_name_y:        row.brick_name_y        ?? THEME_DEFAULTS.brick_name_y,
            brick_name_font:      row.brick_name_font      ?? THEME_DEFAULTS.brick_name_font,
            brick_name_size:      row.brick_name_size      ?? THEME_DEFAULTS.brick_name_size,
            brick_name_color:     row.brick_name_color     ?? THEME_DEFAULTS.brick_name_color,
            bible_translation:    row.bible_translation    ?? THEME_DEFAULTS.bible_translation,
            text_banner_heading:  row.text_banner_heading  ?? THEME_DEFAULTS.text_banner_heading,
            text_banner_body:     row.text_banner_body     ?? THEME_DEFAULTS.text_banner_body,
            text_wall_cta:        row.text_wall_cta        ?? THEME_DEFAULTS.text_wall_cta,
            text_modal_title:     row.text_modal_title     ?? THEME_DEFAULTS.text_modal_title,
            text_success_heading: row.text_success_heading ?? THEME_DEFAULTS.text_success_heading,
            text_success_body:    row.text_success_body    ?? THEME_DEFAULTS.text_success_body,
            text_submit_button:   row.text_submit_button   ?? THEME_DEFAULTS.text_submit_button,
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
    onDone?.()
  }

  function handleReset() {
    setDraft(DEFAULTS)
    applyTheme(DEFAULTS)
    setSaved(false)
  }

  if (loading) return <p className="text-stone-400 text-sm py-8 text-center">Loading theme…</p>

  return (
    <>
    {saving && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/70 backdrop-blur-sm">
        <Loader2 className="animate-spin text-[var(--color-primary)]" size={48} />
      </div>
    )}
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
      </section>

      {/* Muted / secondary text color — separated per meeting request */}
      <section className="bg-white border border-stone-200 rounded-lg px-5 py-5 space-y-4">
        <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Muted / Secondary Color</h3>
        <ColorRow
          label="Muted"
          description="Global secondary labels, subtext, and icons (links, back arrows, etc.)"
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
          description="Title color"
          value={draft.color_header_text}
          onChange={v => update('color_header_text', v)}
        />
        <ColorRow
          label="Subtext"
          description="Org name / secondary line color"
          value={draft.color_header_subtext}
          onChange={v => update('color_header_subtext', v)}
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
          description="Banner heading text color"
          value={draft.color_banner_text}
          onChange={v => update('color_banner_text', v)}
        />
        <ColorRow
          label="Subtext"
          description="Banner description / secondary text color"
          value={draft.color_banner_subtext}
          onChange={v => update('color_banner_subtext', v)}
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

      {/* Bible Translation section */}
      <section className="bg-white border border-stone-200 rounded-lg px-5 py-5 space-y-4">
        <div>
          <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Email Bible Translation</h3>
          <p className="text-xs text-stone-400 mt-0.5">Choose which translation appears in prayer reminder emails.</p>
        </div>
        <div className="flex gap-2">
          {(['ESV', 'NIV'] as const).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => update('bible_translation', t)}
              className={`flex-1 py-2 rounded-md text-sm font-medium border transition-colors ${
                draft.bible_translation === t
                  ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                  : 'bg-white text-stone-600 border-stone-300 hover:border-stone-400'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <p className="text-xs text-stone-400">
          ESV via API.Bible &middot; NIV via YouVersion or API.Bible &middot; Requires <code className="text-xs bg-stone-100 px-1 rounded">API_BIBLE_KEY</code> secret in Supabase
        </p>
      </section>

      {/* Brick Name section */}
      <section className="bg-white border border-stone-200 rounded-lg px-5 py-5 space-y-4">
        <div>
          <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Brick Name</h3>
          <p className="text-xs text-stone-400 mt-0.5">Control how names appear on each brick.</p>
        </div>

        <SliderRow
          label="Vertical position"
          description={`${draft.brick_name_y}% from top`}
          value={draft.brick_name_y}
          min={0} max={100} step={1}
          onChange={v => update('brick_name_y', v)}
        />

        <FontRow
          label="Font"
          value={draft.brick_name_font}
          onChange={v => update('brick_name_font', v)}
        />

        <SliderRow
          label="Font size"
          description={`${draft.brick_name_size.toFixed(2)}× base size`}
          value={draft.brick_name_size}
          min={0.5} max={2.0} step={0.05}
          onChange={v => update('brick_name_size', v)}
        />

        <ColorRow
          label="Color"
          description="Name text color on the brick"
          value={draft.brick_name_color}
          onChange={v => update('brick_name_color', v)}
        />
      </section>

      {/* Editable UI Text */}
      <section className="bg-white border border-stone-200 rounded-lg px-5 py-5 space-y-4">
        <div>
          <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wide">UI Text</h3>
          <p className="text-xs text-stone-400 mt-0.5">Edit the static headings, prompts, and button labels shown on the wall.</p>
        </div>
        <TextRow
          label="Banner heading"
          description='Shown above the category badges (e.g. "Add your name to the wall")'
          value={draft.text_banner_heading}
          onChange={v => update('text_banner_heading', v)}
        />
        <TextRow
          label="Banner description"
          description='Explanatory line below the heading'
          value={draft.text_banner_body}
          onChange={v => update('text_banner_body', v)}
          multiline
        />
        <TextRow
          label="Wall call-to-action"
          description='Prompt above the stone grid (e.g. "Click the next open stone to join!")'
          value={draft.text_wall_cta}
          onChange={v => update('text_wall_cta', v)}
        />
        <TextRow
          label="Pop-up title"
          description='Title of the commitment form dialog'
          value={draft.text_modal_title}
          onChange={v => update('text_modal_title', v)}
        />
        <TextRow
          label="Success heading"
          description='Shown after a stone is placed'
          value={draft.text_success_heading}
          onChange={v => update('text_success_heading', v)}
        />
        <TextRow
          label="Success message"
          description='Sub-line after a stone is placed'
          value={draft.text_success_body}
          onChange={v => update('text_success_body', v)}
        />
        <TextRow
          label="Submit button"
          description='Label on the form submit button'
          value={draft.text_submit_button}
          onChange={v => update('text_submit_button', v)}
        />
      </section>

      {/* Wall Layout section */}
      <section className="bg-white border border-stone-200 rounded-lg px-5 py-5 space-y-5">
        <div>
          <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Wall Layout</h3>
          <p className="text-xs text-stone-400 mt-0.5">Control brick size, shape, and density. Changes preview live.</p>
        </div>
        <SliderRow
          label="Bricks per row"
          description={`${draft.stones_per_row} bricks across (full rows)`}
          value={draft.stones_per_row}
          min={2} max={10} step={1}
          onChange={v => update('stones_per_row', v)}
        />
        <SliderRow
          label="Brick scale"
          description={`${draft.brick_scale.toFixed(2)}× — overall size multiplier`}
          value={draft.brick_scale}
          min={0.4} max={2.0} step={0.05}
          onChange={v => update('brick_scale', v)}
        />
        <SliderRow
          label="Brick shape (height ratio)"
          description={`${draft.brick_aspect.toFixed(2)} — height as fraction of width (0.3 = flat, 0.8 = tall)`}
          value={draft.brick_aspect}
          min={0.3} max={0.8} step={0.01}
          onChange={v => update('brick_aspect', v)}
        />
        <SliderRow
          label="Horizontal overlap"
          description={`${draft.brick_overlap_x}px — how far bricks overlap sideways`}
          value={draft.brick_overlap_x}
          min={0} max={300} step={1}
          onChange={v => update('brick_overlap_x', v)}
        />
        <SliderRow
          label="Row spacing (vertical overlap)"
          description={`${draft.brick_overlap_y}px — higher = rows closer together`}
          value={draft.brick_overlap_y}
          min={0} max={300} step={1}
          onChange={v => update('brick_overlap_y', v)}
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
    </>
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

interface SliderRowProps {
  label: string
  description: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
}

interface TextRowProps {
  label: string
  description: string
  value: string
  onChange: (v: string) => void
  multiline?: boolean
}

function TextRow({ label, description, value, onChange, multiline }: TextRowProps) {
  const cls = "w-full border border-stone-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40"
  return (
    <div>
      <label className="block text-sm font-medium text-stone-700 mb-0.5">{label}</label>
      <p className="text-xs text-stone-400 mb-1.5">{description}</p>
      {multiline ? (
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          rows={2}
          className={cls + ' resize-y'}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          className={cls}
        />
      )}
    </div>
  )
}

function SliderRow({ label, description, value, min, max, step, onChange }: SliderRowProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-stone-800">{label}</p>
        <p className="text-xs text-stone-400">{description}</p>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-[var(--color-primary)]"
      />
      <div className="flex justify-between text-xs text-stone-300">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  )
}
