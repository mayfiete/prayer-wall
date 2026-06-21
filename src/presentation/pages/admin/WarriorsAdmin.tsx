import { useState, useEffect, useCallback } from 'react'
import type { FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../../infrastructure/supabase/types'
import { Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react'
import { PrayerPointsAdmin } from './PrayerPointsAdmin'
import { RhythmAssignmentAdmin } from './RhythmAssignmentAdmin'

const WALL_ID = (import.meta.env.VITE_WALL_ID as string | undefined)?.trim() ?? ''

type CommitmentRow = Database['prayer_wall']['Tables']['commitments']['Row']

interface BricklayersAdminProps {
  supabase: SupabaseClient<Database>
  onDone?: () => void
}

export function WarriorsAdmin({ supabase, onDone }: BricklayersAdminProps) {
  const [bricklayers, setBricklayers] = useState<CommitmentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [opError, setOpError] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editRequest, setEditRequest] = useState('')

  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newRequest, setNewRequest] = useState('')
  const [adding, setAdding] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('commitments')
      .select('*')
      .eq('wall_id', WALL_ID)
      .order('committed_at', { ascending: false })
    if (error) setOpError(error.message)
    else setBricklayers((data ?? []) as CommitmentRow[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { void load() }, [load])

  function toggleExpand(id: string) {
    setExpandedId(prev => prev === id ? null : id)
  }

  function startEdit(w: CommitmentRow) {
    setEditingId(w.id)
    setEditName(w.name)
    setEditEmail(w.email)
    setEditRequest(w.prayer_request)
    setOpError('')
  }

  async function commitEdit(id: string) {
    if (!editName.trim()) { setOpError('Name cannot be empty'); return }
    setOpError('')
    const { error } = await supabase
      .from('commitments')
      .update({ name: editName.trim(), email: editEmail.trim(), prayer_request: editRequest.trim() })
      .eq('id', id)
    if (error) { setOpError(error.message); return }
    setEditingId(null)
    await load()
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!newName.trim() || !newEmail.trim()) return
    setAdding(true)
    setOpError('')
    const { error } = await supabase.from('commitments').insert({
      wall_id: WALL_ID,
      name: newName.trim(),
      email: newEmail.trim(),
      prayer_request: newRequest.trim(),
    })
    if (error) setOpError(error.message)
    else { setNewName(''); setNewEmail(''); setNewRequest('') }
    setAdding(false)
    await load()
  }

  async function handleDelete(id: string, name: string) {
    if (!globalThis.confirm(`Remove "${name}" from the Bricklayers list? This will also remove them from the prayer wall.`)) return
    setOpError('')
    const { error } = await supabase.from('commitments').delete().eq('id', id)
    if (error) setOpError(error.message)
    else await load()
  }

  async function handleToggleReminder(id: string, active: boolean) {
    const { error } = await supabase.from('commitments').update({ reminder_active: active }).eq('id', id)
    if (error) setOpError(error.message)
    else setBricklayers(prev => prev.map(w => w.id === id ? { ...w, reminder_active: active } : w))
  }

  if (loading) return <p className="text-stone-400 text-sm py-8 text-center">Loading…</p>

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[var(--color-heading)]">Bricklayers</h2>
        <p className="text-xs text-stone-400 mt-0.5">
          Everyone who has placed a stone on the wall. Click a row to edit their name or prayer request.
        </p>
      </div>

      {opError && <p className="text-sm text-red-600">{opError}</p>}

      {/* Add form */}
      <form onSubmit={e => void handleAdd(e)} className="bg-white border border-stone-200 rounded-lg px-4 py-4 space-y-3">
        <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Add a Bricklayer</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-stone-500 mb-0.5">Name *</label>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Full name"
              className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40"
            />
          </div>
          <div>
            <label className="block text-xs text-stone-500 mb-0.5">Email *</label>
            <input
              type="email"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              placeholder="email@example.com"
              className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs text-stone-500 mb-0.5">Prayer request</label>
          <textarea
            value={newRequest}
            onChange={e => setNewRequest(e.target.value)}
            placeholder="What are they praying for?"
            rows={2}
            className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40"
          />
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={adding || !newName.trim() || !newEmail.trim()}
            className="flex items-center gap-1.5 px-4 py-2 bg-[var(--color-primary)] text-white rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-60"
          >
            <Plus size={14} />
            Add Bricklayer
          </button>
        </div>
      </form>

      {/* List */}
      <div className="border border-stone-200 rounded-lg overflow-hidden divide-y divide-stone-200">
        {bricklayers.length === 0 && (
          <p className="text-sm text-stone-400 text-center py-6">No bricklayers yet.</p>
        )}
        {bricklayers.map((w) => (
          <div key={w.id} className="bg-white">
            {editingId === w.id ? (
              /* Edit mode */
              <div className="px-4 py-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-stone-500 mb-0.5">Name</label>
                    <input
                      autoFocus
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="w-full border border-[var(--color-primary)] rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-stone-500 mb-0.5">Email</label>
                    <input
                      type="email"
                      value={editEmail}
                      onChange={e => setEditEmail(e.target.value)}
                      className="w-full border border-stone-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-stone-500 mb-0.5">Prayer request</label>
                  <textarea
                    value={editRequest}
                    onChange={e => setEditRequest(e.target.value)}
                    rows={3}
                    className="w-full border border-stone-300 rounded px-2 py-1 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => void commitEdit(w.id)}
                    className="px-3 py-1 bg-[var(--color-primary)] text-white rounded text-xs font-medium hover:opacity-90"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="px-3 py-1 bg-stone-100 text-stone-600 rounded text-xs font-medium hover:bg-stone-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              /* View mode */
              <div>
                <div className="flex items-start gap-3 px-4 py-3">
                  {/* Expand toggle */}
                  <button
                    onClick={() => toggleExpand(w.id)}
                    className="mt-0.5 shrink-0 text-stone-400 hover:text-stone-700"
                    aria-label="Toggle prayer points"
                  >
                    {expandedId === w.id
                      ? <ChevronDown size={14} />
                      : <ChevronRight size={14} />}
                  </button>

                  {/* Name + email + request */}
                  <button
                    className="flex-1 min-w-0 text-left"
                    onClick={() => startEdit(w)}
                    title="Click to edit"
                  >
                    <p className="text-sm font-medium truncate text-stone-800 hover:text-[var(--color-primary)]">
                      {w.name}
                    </p>
                    <p className="text-xs text-stone-400 truncate">{w.email}</p>
                    {w.prayer_request && (
                      <p className="text-xs text-stone-500 mt-0.5 line-clamp-2 leading-relaxed">{w.prayer_request}</p>
                    )}
                  </button>

                  {/* Committed date */}
                  <span className="text-xs text-stone-400 shrink-0 mt-0.5 hidden sm:block">
                    {new Date(w.committed_at).toLocaleDateString()}
                  </span>

                  {/* Reminder toggle */}
                  <label className="flex items-center gap-1.5 text-xs text-stone-500 select-none cursor-pointer shrink-0 mt-1" title="Email reminders">
                    <input
                      type="checkbox"
                      checked={w.reminder_active}
                      onChange={e => void handleToggleReminder(w.id, e.target.checked)}
                      className="accent-[var(--color-primary)]"
                    />
                    Reminders
                  </label>

                  {/* Delete */}
                  <button
                    onClick={() => void handleDelete(w.id, w.name)}
                    className="p-1 text-stone-300 hover:text-red-500 shrink-0 mt-0.5"
                    aria-label={`Remove ${w.name}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Prayer points + rhythms — expanded */}
                {expandedId === w.id && (
                  <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <PrayerPointsAdmin
                      supabase={supabase}
                      commitmentId={w.id}
                      bricklayerName={w.name}
                    />
                    <RhythmAssignmentAdmin
                      supabase={supabase}
                      commitmentId={w.id}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
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
