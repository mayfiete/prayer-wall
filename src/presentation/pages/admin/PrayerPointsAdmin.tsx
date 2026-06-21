import { useState, useEffect, useCallback } from 'react'
import type { FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../../infrastructure/supabase/types'
import { Plus, Trash2, CheckCircle, Circle } from 'lucide-react'

type PrayerPointRow = Database['prayer_wall']['Tables']['prayer_points']['Row']

interface PrayerPointsAdminProps {
  supabase: SupabaseClient<Database>
  commitmentId: string
  bricklayerName: string
}

export function PrayerPointsAdmin({ supabase, commitmentId, bricklayerName }: PrayerPointsAdminProps) {
  const [points, setPoints] = useState<PrayerPointRow[]>([])
  const [loading, setLoading] = useState(true)
  const [opError, setOpError] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editBody, setEditBody] = useState('')

  const [newBody, setNewBody] = useState('')
  const [adding, setAdding] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('prayer_points')
      .select('*')
      .eq('commitment_id', commitmentId)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true })
    if (error) setOpError(error.message)
    else setPoints((data ?? []) as PrayerPointRow[])
    setLoading(false)
  }, [supabase, commitmentId])

  useEffect(() => { void load() }, [load])

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!newBody.trim()) return
    setAdding(true)
    setOpError('')
    const nextOrder = points.length > 0 ? Math.max(...points.map(p => p.display_order)) + 1 : 0
    const { error } = await supabase.from('prayer_points').insert({
      commitment_id: commitmentId,
      body: newBody.trim(),
      display_order: nextOrder,
    })
    if (error) setOpError(error.message)
    else setNewBody('')
    setAdding(false)
    await load()
  }

  async function commitEdit(id: string) {
    if (!editBody.trim()) return
    setOpError('')
    const { error } = await supabase
      .from('prayer_points')
      .update({ body: editBody.trim() })
      .eq('id', id)
    if (error) { setOpError(error.message); return }
    setEditingId(null)
    await load()
  }

  async function handleToggleAnswered(id: string, answered: boolean) {
    const { error } = await supabase
      .from('prayer_points')
      .update({ is_answered: answered })
      .eq('id', id)
    if (error) setOpError(error.message)
    else setPoints(prev => prev.map(p => p.id === id ? { ...p, is_answered: answered } : p))
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('prayer_points').delete().eq('id', id)
    if (error) setOpError(error.message)
    else await load()
  }

  return (
    <div className="mt-3 pl-3 border-l-2 border-stone-100 space-y-2">
      <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide">
        Prayer Points — {bricklayerName}
      </p>

      {opError && <p className="text-xs text-red-500">{opError}</p>}

      {loading ? (
        <p className="text-xs text-stone-400">Loading…</p>
      ) : (
        <>
          {points.length === 0 && (
            <p className="text-xs text-stone-400 italic">No prayer points yet.</p>
          )}
          <ul className="space-y-1">
            {points.map(p => (
              <li key={p.id} className="flex items-start gap-2 group">
                {/* Answered toggle */}
                <button
                  onClick={() => void handleToggleAnswered(p.id, !p.is_answered)}
                  className="mt-0.5 shrink-0 text-stone-300 hover:text-[var(--color-primary)] transition-colors"
                  title={p.is_answered ? 'Mark unanswered' : 'Mark answered'}
                >
                  {p.is_answered
                    ? <CheckCircle size={14} className="text-[var(--color-primary)]" />
                    : <Circle size={14} />
                  }
                </button>

                {/* Body / edit inline */}
                {editingId === p.id ? (
                  <div className="flex-1 flex gap-1">
                    <input
                      autoFocus
                      value={editBody}
                      onChange={e => setEditBody(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') void commitEdit(p.id); if (e.key === 'Escape') setEditingId(null) }}
                      className="flex-1 border border-[var(--color-primary)] rounded px-2 py-0.5 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40"
                    />
                    <button onClick={() => void commitEdit(p.id)} className="text-xs px-2 py-0.5 bg-[var(--color-primary)] text-white rounded hover:opacity-90">Save</button>
                    <button onClick={() => setEditingId(null)} className="text-xs px-2 py-0.5 bg-stone-100 text-stone-500 rounded hover:bg-stone-200">✕</button>
                  </div>
                ) : (
                  <button
                    className={`flex-1 text-left text-xs leading-relaxed ${p.is_answered ? 'line-through text-stone-400' : 'text-stone-700 hover:text-[var(--color-primary)]'}`}
                    onClick={() => { setEditingId(p.id); setEditBody(p.body) }}
                    title="Click to edit"
                  >
                    {p.body}
                  </button>
                )}

                {/* Delete */}
                <button
                  onClick={() => void handleDelete(p.id)}
                  className="shrink-0 text-stone-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5"
                  aria-label="Delete prayer point"
                >
                  <Trash2 size={12} />
                </button>
              </li>
            ))}
          </ul>

          {/* Add new point */}
          <form onSubmit={e => void handleAdd(e)} className="flex gap-2 mt-2">
            <input
              value={newBody}
              onChange={e => setNewBody(e.target.value)}
              placeholder="Add a prayer point…"
              className="flex-1 border border-stone-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40"
            />
            <button
              type="submit"
              disabled={adding || !newBody.trim()}
              className="flex items-center gap-1 px-2 py-1 bg-[var(--color-primary)] text-white rounded text-xs font-medium hover:opacity-90 disabled:opacity-50"
            >
              <Plus size={12} />
              Add
            </button>
          </form>
        </>
      )}
    </div>
  )
}
