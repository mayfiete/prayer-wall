import { useState, useEffect, useCallback } from 'react'
import type { FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../../infrastructure/supabase/types'
import { Save, Clock, Mail, CheckCircle, Plus, Trash2, Pencil } from 'lucide-react'

type Cadence = 'daily' | 'weekly' | 'monthly'
type RhythmRow = Database['prayer_wall']['Tables']['email_rhythms']['Row']

const WALL_ID = (import.meta.env.VITE_WALL_ID as string | undefined)?.trim() ?? ''
const ORG_ID  = (import.meta.env.VITE_ORG_ID  as string | undefined)?.trim() ?? ''

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
]

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'America/Anchorage',
  'Pacific/Honolulu',
]

const TIMEZONE_LABELS: Record<string, string> = {
  'America/New_York':    'Eastern (ET)',
  'America/Chicago':     'Central (CT)',
  'America/Denver':      'Mountain (MT)',
  'America/Los_Angeles': 'Pacific (PT)',
  'America/Phoenix':     'Arizona (no DST)',
  'America/Anchorage':   'Alaska (AKT)',
  'Pacific/Honolulu':    'Hawaii (HT)',
}

const DAYS_OF_MONTH = Array.from({ length: 28 }, (_, i) => i + 1)

interface RhythmDraft {
  name: string
  cadence: Cadence
  dayOfWeek: number
  dayOfMonth: number
  sendTime: string
  timezone: string
  isActive: boolean
}

const BLANK_DRAFT: RhythmDraft = {
  name: '',
  cadence: 'weekly',
  dayOfWeek: 0,
  dayOfMonth: 1,
  sendTime: '09:00',
  timezone: 'America/New_York',
  isActive: true,
}

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}

function formatSummary(r: Pick<RhythmRow, 'cadence' | 'day_of_week' | 'day_of_month' | 'send_time' | 'timezone'>): string {
  const [h, m] = r.send_time.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  const time = `${hour}:${String(m).padStart(2, '0')} ${ampm}`
  const tz = TIMEZONE_LABELS[r.timezone] ?? r.timezone
  if (r.cadence === 'daily') return `Every day at ${time} ${tz}`
  if (r.cadence === 'weekly') {
    const day = DAYS_OF_WEEK.find(d => d.value === r.day_of_week)?.label ?? 'Sunday'
    return `Every ${day} at ${time} ${tz}`
  }
  return `Monthly on the ${ordinal(r.day_of_month ?? 1)} at ${time} ${tz}`
}

interface RhythmsAdminProps {
  supabase: SupabaseClient<Database>
  onDone?: () => void
}

export function RhythmsAdmin({ supabase, onDone }: RhythmsAdminProps) {
  const [rhythms, setRhythms] = useState<RhythmRow[]>([])
  const [loading, setLoading] = useState(true)
  const [opError, setOpError] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<RhythmDraft>(BLANK_DRAFT)
  const [saving, setSaving] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('email_rhythms')
      .select('*')
      .eq('wall_id', WALL_ID)
      .order('created_at', { ascending: true })
    if (error) setOpError(error.message)
    else setRhythms((data ?? []) as RhythmRow[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { void load() }, [load])

  function openAdd() {
    setEditingId(null)
    setDraft(BLANK_DRAFT)
    setShowForm(true)
    setOpError('')
  }

  function openEdit(r: RhythmRow) {
    setEditingId(r.id)
    setDraft({
      name:       r.name,
      cadence:    r.cadence,
      dayOfWeek:  r.day_of_week ?? 0,
      dayOfMonth: r.day_of_month ?? 1,
      sendTime:   r.send_time,
      timezone:   r.timezone,
      isActive:   r.is_active,
    })
    setShowForm(true)
    setOpError('')
  }

  function updateDraft<K extends keyof RhythmDraft>(key: K, value: RhythmDraft[K]) {
    setDraft(prev => ({ ...prev, [key]: value }))
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    if (!draft.name.trim()) { setOpError('Rhythm name is required'); return }
    setSaving(true)
    setOpError('')

    const payload = {
      org_id:       ORG_ID,
      wall_id:      WALL_ID,
      name:         draft.name.trim(),
      cadence:      draft.cadence,
      day_of_week:  draft.cadence === 'weekly'  ? draft.dayOfWeek  : null,
      day_of_month: draft.cadence === 'monthly' ? draft.dayOfMonth : null,
      send_time:    draft.sendTime,
      timezone:     draft.timezone,
      is_active:    draft.isActive,
    }

    let id = editingId
    if (editingId) {
      const { error } = await supabase.from('email_rhythms').update(payload).eq('id', editingId)
      if (error) { setOpError(error.message); setSaving(false); return }
    } else {
      const { data, error } = await supabase.from('email_rhythms').insert(payload).select('id').single()
      if (error) { setOpError(error.message); setSaving(false); return }
      id = (data as { id: string }).id
    }

    setSaving(false)
    setSavedId(id)
    setTimeout(() => setSavedId(null), 2000)
    setShowForm(false)
    setEditingId(null)
    await load()
  }

  async function handleDelete(id: string, name: string) {
    if (!globalThis.confirm(`Delete rhythm "${name}"? Bricklayers assigned to this rhythm will lose it.`)) return
    const { error } = await supabase.from('email_rhythms').delete().eq('id', id)
    if (error) setOpError(error.message)
    else await load()
  }

  async function handleToggleActive(r: RhythmRow) {
    const { error } = await supabase.from('email_rhythms').update({ is_active: !r.is_active }).eq('id', r.id)
    if (error) setOpError(error.message)
    else setRhythms(prev => prev.map(x => x.id === r.id ? { ...x, is_active: !r.is_active } : x))
  }

  const selectClass = 'border border-stone-300 rounded-md px-3 py-2 text-sm text-stone-800 bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40 w-full'
  const labelClass  = 'block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1'

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-heading)]">Prayer Rhythms</h2>
          <p className="text-xs text-stone-400 mt-0.5">
            Define reusable reminder schedules. Assign them to individual Bricklayers.
          </p>
        </div>
        {!showForm && (
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 px-3 py-2 bg-[var(--color-primary)] text-white rounded-md text-sm font-medium hover:opacity-90"
          >
            <Plus size={14} />
            New Rhythm
          </button>
        )}
      </div>

      {opError && <p className="text-sm text-red-600">{opError}</p>}

      {/* Add / Edit form */}
      {showForm && (
        <form onSubmit={e => void handleSave(e)} className="bg-white border border-stone-200 rounded-lg px-5 py-5 space-y-5">
          <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">
            {editingId ? 'Edit Rhythm' : 'New Rhythm'}
          </p>

          {/* Name */}
          <div>
            <label className={labelClass}>Name</label>
            <input
              autoFocus
              value={draft.name}
              onChange={e => updateDraft('name', e.target.value)}
              placeholder="e.g. Weekly Sunday Morning"
              className={selectClass}
            />
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between">
            <label className={labelClass + ' mb-0'}>Active</label>
            <button
              type="button"
              onClick={() => updateDraft('isActive', !draft.isActive)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40 ${
                draft.isActive ? 'bg-[var(--color-primary)]' : 'bg-stone-200'
              }`}
              role="switch"
              aria-checked={draft.isActive}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${draft.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {/* Cadence */}
          <div>
            <p className={labelClass}>Cadence</p>
            <div className="flex gap-3">
              {(['daily', 'weekly', 'monthly'] as Cadence[]).map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => updateDraft('cadence', c)}
                  className={`flex-1 py-2.5 rounded-md text-sm font-medium border transition-colors ${
                    draft.cadence === c
                      ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                      : 'bg-white text-stone-600 border-stone-200 hover:border-stone-400'
                  }`}
                >
                  {{ daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' }[c]}
                </button>
              ))}
            </div>
          </div>

          {draft.cadence === 'weekly' && (
            <div>
              <label className={labelClass}>Day of week</label>
              <select value={draft.dayOfWeek} onChange={e => updateDraft('dayOfWeek', Number(e.target.value))} className={selectClass}>
                {DAYS_OF_WEEK.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
          )}

          {draft.cadence === 'monthly' && (
            <div>
              <label className={labelClass}>Day of month</label>
              <select value={draft.dayOfMonth} onChange={e => updateDraft('dayOfMonth', Number(e.target.value))} className={selectClass}>
                {DAYS_OF_MONTH.map(d => <option key={d} value={d}>{ordinal(d)}</option>)}
              </select>
              <p className="text-[11px] text-stone-400 mt-1">Max 28th to ensure delivery every month.</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Send time</label>
              <div className="relative">
                <Clock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                <input type="time" value={draft.sendTime} onChange={e => updateDraft('sendTime', e.target.value)} className={`${selectClass} pl-8`} />
              </div>
            </div>
            <div>
              <label className={labelClass}>Timezone</label>
              <select value={draft.timezone} onChange={e => updateDraft('timezone', e.target.value)} className={selectClass}>
                {TIMEZONES.map(tz => <option key={tz} value={tz}>{TIMEZONE_LABELS[tz]}</option>)}
              </select>
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => { setShowForm(false); setEditingId(null) }} className="px-4 py-2 bg-stone-100 text-stone-600 rounded-md text-sm font-medium hover:bg-stone-200">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex items-center gap-1.5 px-4 py-2 bg-[var(--color-primary)] text-white rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-60">
              <Save size={14} />
              {saving ? 'Saving…' : editingId ? 'Update Rhythm' : 'Save Rhythm'}
            </button>
          </div>
        </form>
      )}

      {/* Rhythm list */}
      {loading ? (
        <p className="text-sm text-stone-400 text-center py-6">Loading…</p>
      ) : rhythms.length === 0 && !showForm ? (
        <p className="text-sm text-stone-400 text-center py-6">No rhythms yet — create one above.</p>
      ) : (
        <div className="border border-stone-200 rounded-lg overflow-hidden divide-y divide-stone-200">
          {rhythms.map(r => (
            <div key={r.id} className="bg-white flex items-start gap-3 px-4 py-3">
              {/* Active toggle */}
              <button
                onClick={() => void handleToggleActive(r)}
                className="mt-0.5 shrink-0"
                title={r.is_active ? 'Pause this rhythm' : 'Activate this rhythm'}
              >
                <Mail size={16} className={r.is_active ? 'text-[var(--color-primary)]' : 'text-stone-300'} />
              </button>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-stone-800 truncate">{r.name}</p>
                  {savedId === r.id && (
                    <span className="flex items-center gap-1 text-xs text-emerald-600">
                      <CheckCircle size={12} /> Saved
                    </span>
                  )}
                  {!r.is_active && <span className="text-xs text-stone-400 italic">paused</span>}
                </div>
                <p className="text-xs text-stone-500 mt-0.5">{formatSummary(r)}</p>
              </div>

              {/* Edit */}
              <button onClick={() => openEdit(r)} className="p-1 text-stone-300 hover:text-stone-600 shrink-0 mt-0.5" aria-label="Edit rhythm">
                <Pencil size={14} />
              </button>

              {/* Delete */}
              <button onClick={() => void handleDelete(r.id, r.name)} className="p-1 text-stone-300 hover:text-red-500 shrink-0 mt-0.5" aria-label="Delete rhythm">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* How it works */}
      <div className="text-sm text-stone-500 border-t border-stone-200 pt-5 space-y-2">
        <p className="font-semibold text-stone-600">How it works</p>
        <p>
          Each rhythm is a named schedule — like <em>"Weekly Sunday at 9 AM"</em> or <em>"Daily at 7 AM"</em>.
          You create rhythms here, then assign one or more to each Bricklayer on the Bricklayers tab.
        </p>
        <p>
          When a rhythm fires, the bricklayer receives a personal email with their name, their prayer request,
          and a prayer point to reflect on. Only active rhythms send emails.
        </p>
        <p className="text-xs text-stone-400">
          Emails are delivered via a scheduled background job. A bricklayer with no rhythm assigned will not receive reminders.
        </p>
      </div>

      <div className="border-t border-stone-200 pt-6 flex justify-end">
        <button
          onClick={onDone}
          className="px-6 py-2.5 rounded-md bg-amber-600 hover:bg-amber-500 text-stone-950 text-sm font-semibold transition-colors"
        >
          Done
        </button>
      </div>

    </div>
  )
}
