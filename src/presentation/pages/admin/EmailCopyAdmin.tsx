import { useEffect, useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { CheckCircle, Loader2, RefreshCw, Save } from 'lucide-react'
import type { Database } from '../../../infrastructure/supabase/types'
import {
  EMAIL_COPY_DEFAULTS,
  EMAIL_COPY_GROUP_LABELS,
  emailCopyFieldsForScope,
} from '../../../infrastructure/email/emailCopy'
import type { EmailCopyField, EmailCopyGroup } from '../../../infrastructure/email/emailCopy'

interface EmailCopyAdminProps {
  supabase: SupabaseClient<Database>
  wallId: string
  /** Which set of emails this wall sends. */
  scope: 'prayer' | 'giving'
  onDone?: () => void
}

type Draft = Record<string, string>

const GROUP_ORDER: EmailCopyGroup[] = [
  'brand',
  'shared',
  'confirmation',
  'guide',
  'reminder',
  'donation',
]

export function EmailCopyAdmin({ supabase, wallId, scope, onDone }: EmailCopyAdminProps) {
  const fields = useMemo(() => emailCopyFieldsForScope(scope), [scope])
  const defaults = useMemo<Draft>(
    () => Object.fromEntries(fields.map(f => [f.key, EMAIL_COPY_DEFAULTS[f.key]])),
    [fields],
  )

  const [draft, setDraft] = useState<Draft>(defaults)
  const [savedDraft, setSavedDraft] = useState<Draft>(defaults)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!wallId) { setLoading(false); return }
    let cancelled = false
    setLoading(true)
    void supabase
      .from('email_copy')
      .select('copy_key, value')
      .eq('wall_id', wallId)
      .then(({ data, error: loadError }) => {
        if (cancelled) return
        if (loadError) setError(loadError.message)
        const stored = Object.fromEntries(
          (data ?? [])
            .filter(row => row.copy_key in defaults)
            .map(row => [row.copy_key, row.value ?? '']),
        )
        const loaded = { ...defaults, ...stored }
        setDraft(loaded)
        setSavedDraft(loaded)
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [supabase, wallId, defaults])

  function update(key: string, value: string) {
    setDraft(prev => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  async function handleSave() {
    if (!wallId) {
      setError('Wall ID is not set — ensure VITE_WALL_ID (prayer) or VITE_GIVING_WALL_ID (giving) is configured.')
      return
    }
    setSaving(true)
    setError('')

    // Only wording that differs from the shipped default is stored, so future
    // default changes still reach walls that never customised a line.
    const overrides = fields
      .filter(f => draft[f.key] !== defaults[f.key])
      .map(f => ({ wall_id: wallId, copy_key: f.key, value: draft[f.key] }))
    const reverted = fields
      .filter(f => draft[f.key] === defaults[f.key])
      .map(f => f.key as string)

    if (overrides.length > 0) {
      const { error: upsertError } = await supabase
        .from('email_copy')
        .upsert(overrides, { onConflict: 'wall_id,copy_key' })
      if (upsertError) { setSaving(false); setError(upsertError.message); return }
    }

    if (reverted.length > 0) {
      const { error: deleteError } = await supabase
        .from('email_copy')
        .delete()
        .eq('wall_id', wallId)
        .in('copy_key', reverted)
      if (deleteError) { setSaving(false); setError(deleteError.message); return }
    }

    setSaving(false)
    setSavedDraft({ ...draft })
    setSaved(true)
    onDone?.()
  }

  function handleReset() {
    setDraft(defaults)
    setSaved(false)
  }

  if (loading) return <p className="text-stone-400 text-sm py-8 text-center">Loading email text…</p>

  const groups = GROUP_ORDER
    .map(group => ({ group, groupFields: fields.filter(f => f.group === group) }))
    .filter(({ groupFields }) => groupFields.length > 0)

  return (
    <>
      {saving && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/70 backdrop-blur-sm">
          <Loader2 className="animate-spin text-[var(--color-primary)]" size={48} />
        </div>
      )}
      <div className="max-w-xl mx-auto space-y-8">
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-heading)]">Emails</h2>
          <p className="text-xs text-stone-400 mt-0.5">
            Every word of every email this wall sends. Text only — formatting and colours come from
            the shared email design. Saved changes apply to the next email sent.
          </p>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {groups.map(({ group, groupFields }) => (
          <section key={group} className="bg-white border border-stone-200 rounded-lg px-4 py-5 sm:px-5 space-y-4">
            <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wide">
              {EMAIL_COPY_GROUP_LABELS[group]}
            </h3>
            {groupFields.map(field => (
              <CopyRow
                key={field.key}
                field={field}
                value={draft[field.key] ?? ''}
                isDirty={draft[field.key] !== savedDraft[field.key]}
                onChange={value => update(field.key, value)}
              />
            ))}
          </section>
        ))}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-4">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 text-sm text-stone-400 hover:text-stone-700 transition-colors"
          >
            <RefreshCw size={13} />
            Reset all to defaults
          </button>

          <div className="flex flex-wrap items-center gap-4">
            {saved && (
              <span className="flex items-center gap-1.5 text-sm text-emerald-600">
                <CheckCircle size={15} />
                Email text saved
              </span>
            )}
            <button
              onClick={() => void handleSave()}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-[var(--color-primary)] text-white rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-60 transition-colors"
            >
              <Save size={14} />
              {saving ? 'Saving…' : 'Save Email Text'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

interface CopyRowProps {
  field: EmailCopyField
  value: string
  isDirty: boolean
  onChange: (value: string) => void
}

function CopyRow({ field, value, isDirty, onChange }: CopyRowProps) {
  const cls = 'w-full border border-stone-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40'
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label className="block text-sm font-medium text-stone-700 mb-0.5">{field.label}</label>
        {isDirty && <span className="text-xs text-amber-600">edited</span>}
      </div>
      {field.help && <p className="text-xs text-stone-400 mb-1.5">{field.help}</p>}
      {field.multiline ? (
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          rows={4}
          maxLength={5000}
          className={cls + ' resize-y'}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          maxLength={500}
          className={cls}
        />
      )}
    </div>
  )
}
