import { useState } from 'react'
import { Save, Clock, Mail, CheckCircle } from 'lucide-react'

type Cadence = 'daily' | 'weekly' | 'monthly'

interface RhythmConfig {
  cadence: Cadence
  dayOfWeek: number
  dayOfMonth: number
  sendTime: string
  timezone: string
  isActive: boolean
}

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

const DEFAULT_CONFIG: RhythmConfig = {
  cadence: 'weekly',
  dayOfWeek: 0,
  dayOfMonth: 1,
  sendTime: '09:00',
  timezone: 'America/New_York',
  isActive: true,
}

function cadenceLabel(c: Cadence) {
  return { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' }[c]
}

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}

function formatSummary(cfg: RhythmConfig): string {
  const time = (() => {
    const [h, m] = cfg.sendTime.split(':').map(Number)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const hour = h % 12 || 12
    return `${hour}:${String(m).padStart(2, '0')} ${ampm}`
  })()
  const tz = TIMEZONE_LABELS[cfg.timezone] ?? cfg.timezone
  if (cfg.cadence === 'daily') return `Every day at ${time} ${tz}`
  if (cfg.cadence === 'weekly') {
    const day = DAYS_OF_WEEK.find((d) => d.value === cfg.dayOfWeek)?.label ?? 'Sunday'
    return `Every ${day} at ${time} ${tz}`
  }
  return `Monthly on the ${ordinal(cfg.dayOfMonth)} at ${time} ${tz}`
}

export function RhythmsAdmin() {
  const [config, setConfig] = useState<RhythmConfig>(DEFAULT_CONFIG)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  function update<K extends keyof RhythmConfig>(key: K, value: RhythmConfig[K]) {
    setConfig((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  async function handleSave() {
    setSaving(true)
    await new Promise((r) => setTimeout(r, 600))
    setSaving(false)
    setSaved(true)
  }

  const selectClass =
    'border border-stone-300 rounded-md px-3 py-2 text-sm text-stone-800 bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40 w-full'
  const labelClass = 'block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1'

  return (
    <div className="max-w-2xl mx-auto space-y-8">

      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-[var(--color-heading)]">Prayer Rhythms</h2>
        <p className="text-xs text-stone-400 mt-0.5">
          Configure when reminder emails are sent to everyone on the prayer wall.
        </p>
      </div>

      {/* Active toggle */}
      <div className="flex items-center justify-between bg-white border border-stone-200 rounded-lg px-5 py-4">
        <div className="flex items-center gap-3">
          <Mail size={18} className={config.isActive ? 'text-[var(--color-primary)]' : 'text-stone-300'} />
          <div>
            <p className="text-sm font-medium text-stone-800">Email reminders</p>
            <p className="text-xs text-stone-400">
              {config.isActive ? 'Active — emails will be sent on the schedule below' : 'Paused — no emails will be sent'}
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            const next = !config.isActive
            if (next && !window.confirm('Are you sure you want to activate email reminders? Emails will begin sending on the configured schedule.')) return
            update('isActive', next)
          }}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40 ${
            config.isActive ? 'bg-[var(--color-primary)]' : 'bg-stone-200'
          }`}
          role="switch"
          aria-checked={config.isActive}
        >
          <span
            className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
              config.isActive ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Cadence selector */}
      <div className="bg-white border border-stone-200 rounded-lg px-5 py-5 space-y-5">
        <div>
          <p className={labelClass}>Cadence</p>
          <div className="flex gap-3">
            {(['daily', 'weekly', 'monthly'] as Cadence[]).map((c) => (
              <button
                key={c}
                onClick={() => update('cadence', c)}
                className={`flex-1 py-2.5 rounded-md text-sm font-medium border transition-colors ${
                  config.cadence === c
                    ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                    : 'bg-white text-stone-600 border-stone-200 hover:border-stone-400'
                }`}
              >
                {cadenceLabel(c)}
              </button>
            ))}
          </div>
        </div>

        {/* Weekly — day of week */}
        {config.cadence === 'weekly' && (
          <div>
            <label className={labelClass}>Day of week</label>
            <select
              value={config.dayOfWeek}
              onChange={(e) => update('dayOfWeek', Number(e.target.value))}
              className={selectClass}
            >
              {DAYS_OF_WEEK.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </div>
        )}

        {/* Monthly — day of month */}
        {config.cadence === 'monthly' && (
          <div>
            <label className={labelClass}>Day of month</label>
            <select
              value={config.dayOfMonth}
              onChange={(e) => update('dayOfMonth', Number(e.target.value))}
              className={selectClass}
            >
              {DAYS_OF_MONTH.map((d) => (
                <option key={d} value={d}>{ordinal(d)}</option>
              ))}
            </select>
            <p className="text-[11px] text-stone-400 mt-1">Days 29–31 are skipped in short months. Max is 28th to ensure delivery every month.</p>
          </div>
        )}

        {/* Send time */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Send time</label>
            <div className="relative">
              <Clock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
              <input
                type="time"
                value={config.sendTime}
                onChange={(e) => update('sendTime', e.target.value)}
                className={`${selectClass} pl-8`}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Timezone</label>
            <select
              value={config.timezone}
              onChange={(e) => update('timezone', e.target.value)}
              className={selectClass}
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{TIMEZONE_LABELS[tz]}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Summary banner */}
      <div className="bg-[#f9f4f5] border border-[#e8cfd3] rounded-lg px-5 py-4 flex items-start gap-3">
        <Mail size={16} className="text-[var(--color-primary)] mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-[var(--color-primary)]">Current schedule</p>
          <p className="text-sm text-stone-600 mt-0.5">
            {config.isActive ? formatSummary(config) : 'Email reminders are currently paused.'}
          </p>
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center justify-between">
        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-emerald-600">
            <CheckCircle size={15} />
            Rhythm saved
          </span>
        )}
        {!saved && <span />}
        <button
          onClick={() => void handleSave()}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-[var(--color-primary)] text-white rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-60 transition-colors"
        >
          <Save size={14} />
          {saving ? 'Saving…' : 'Save Rhythm'}
        </button>
      </div>

      {/* Info note */}
      <div className="text-xs text-stone-400 border-t border-stone-200 pt-4 space-y-1">
        <p>
          <strong className="text-stone-500">How it works:</strong> A Supabase Edge Function runs on a pg_cron schedule,
          queries all active commitments for this wall, and sends a personalized reminder email via Resend to each person.
          Each email includes one active prayer meditation from their chosen categories.
        </p>
        <p>
          See <code className="bg-stone-100 px-1 rounded">docs/email-rhythm-mechanism.md</code> for full architecture details.
        </p>
      </div>

    </div>
  )
}
