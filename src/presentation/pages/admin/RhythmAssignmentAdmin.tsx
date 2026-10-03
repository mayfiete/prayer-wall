import { useState, useEffect, useCallback } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../../infrastructure/supabase/types'

type RhythmRow = Database['prayer_wall']['Tables']['email_rhythms']['Row']

const WALL_ID = (import.meta.env.VITE_WALL_ID as string | undefined)?.trim() ?? ''

interface RhythmAssignmentAdminProps {
  supabase: SupabaseClient<Database>
  commitmentId: string
}

export function RhythmAssignmentAdmin({ supabase, commitmentId }: RhythmAssignmentAdminProps) {
  const [allRhythms, setAllRhythms]       = useState<RhythmRow[]>([])
  const [assignedIds, setAssignedIds]     = useState<Set<string>>(new Set())
  const [loading, setLoading]             = useState(true)
  const [opError, setOpError]             = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const [rhythmsRes, assignedRes] = await Promise.all([
      supabase
        .from('email_rhythms')
        .select('*')
        .eq('wall_id', WALL_ID)
        .order('created_at', { ascending: true }),
      supabase
        .from('commitment_rhythms')
        .select('rhythm_id')
        .eq('commitment_id', commitmentId),
    ])
    if (rhythmsRes.error) { setOpError(rhythmsRes.error.message); setLoading(false); return }
    if (assignedRes.error) { setOpError(assignedRes.error.message); setLoading(false); return }
    setAllRhythms((rhythmsRes.data ?? []) as RhythmRow[])
    setAssignedIds(new Set((assignedRes.data ?? []).map((r: { rhythm_id: string }) => r.rhythm_id)))
    setLoading(false)
  }, [supabase, commitmentId])

  useEffect(() => { void load() }, [load])

  async function handleToggle(rhythmId: string, assigned: boolean) {
    setOpError('')
    if (assigned) {
      const { error } = await supabase
        .from('commitment_rhythms')
        .delete()
        .eq('commitment_id', commitmentId)
        .eq('rhythm_id', rhythmId)
      if (error) { setOpError(error.message); return }
      setAssignedIds(prev => { const next = new Set(prev); next.delete(rhythmId); return next })
    } else {
      const { error } = await supabase
        .from('commitment_rhythms')
        .insert({ commitment_id: commitmentId, rhythm_id: rhythmId })
      if (error) { setOpError(error.message); return }
      setAssignedIds(prev => new Set([...prev, rhythmId]))
    }
  }

  if (loading) return <p className="text-xs text-stone-400 mt-2">Loading rhythms…</p>

  return (
    <div className="mt-3 pl-3 border-l-2 border-stone-100 space-y-2">
      <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide">Prayer Rhythms</p>

      {opError && <p className="text-xs text-red-500">{opError}</p>}

      {allRhythms.length === 0 ? (
        <p className="text-xs text-stone-400 italic">No rhythms defined yet — create them on the Rhythms tab.</p>
      ) : (
        <ul className="space-y-1">
          {allRhythms.map(r => {
            const assigned = assignedIds.has(r.id)
            return (
              <li key={r.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id={`rhythm-${commitmentId}-${r.id}`}
                  checked={assigned}
                  onChange={() => void handleToggle(r.id, assigned)}
                  className="accent-[var(--color-primary)]"
                />
                <label
                  htmlFor={`rhythm-${commitmentId}-${r.id}`}
                  className={`text-xs cursor-pointer ${r.is_active ? 'text-stone-700' : 'text-stone-400 italic'}`}
                >
                  {r.name}
                  {!r.is_active && <span className="ml-1 text-stone-300">(paused)</span>}
                </label>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
