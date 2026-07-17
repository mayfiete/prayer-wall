import { useState, useEffect, useCallback } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../../infrastructure/supabase/types'

type RhythmRow = Database['prayer_wall']['Tables']['email_rhythms']['Row']

const WALL_ID = (import.meta.env.VITE_WALL_ID as string | undefined)?.trim() ?? ''

interface CategoryRhythmsAdminProps {
  supabase: SupabaseClient<Database>
  categoryId: string
  categoryName: string
}

export function CategoryRhythmsAdmin({ supabase, categoryId, categoryName }: CategoryRhythmsAdminProps) {
  const [allRhythms, setAllRhythms]   = useState<RhythmRow[]>([])
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading]         = useState(true)
  const [opError, setOpError]         = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const [rhythmsRes, assignedRes] = await Promise.all([
      supabase
        .from('email_rhythms')
        .select('*')
        .eq('wall_id', WALL_ID)
        .order('created_at', { ascending: true }),
      supabase
        .from('category_rhythms')
        .select('rhythm_id')
        .eq('category_id', categoryId),
    ])
    if (rhythmsRes.error) { setOpError(rhythmsRes.error.message); setLoading(false); return }
    if (assignedRes.error) { setOpError(assignedRes.error.message); setLoading(false); return }
    setAllRhythms((rhythmsRes.data ?? []) as RhythmRow[])
    setAssignedIds(new Set((assignedRes.data ?? []).map((r: { rhythm_id: string }) => r.rhythm_id)))
    setLoading(false)
  }, [supabase, categoryId])

  useEffect(() => { void load() }, [load])

  async function handleToggle(rhythmId: string, assigned: boolean) {
    setOpError('')
    if (assigned) {
      const { error } = await supabase
        .from('category_rhythms')
        .delete()
        .eq('category_id', categoryId)
        .eq('rhythm_id', rhythmId)
      if (error) { setOpError(error.message); return }
      setAssignedIds(prev => { const next = new Set(prev); next.delete(rhythmId); return next })
    } else {
      const { error } = await supabase
        .from('category_rhythms')
        .insert({ category_id: categoryId, rhythm_id: rhythmId })
      if (error) { setOpError(error.message); return }
      setAssignedIds(prev => new Set([...prev, rhythmId]))
    }
  }

  if (loading) return <p className="text-xs text-stone-400 mt-1">Loading rhythms…</p>

  return (
    <div className="mt-3 space-y-1.5">
      <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide">
        Rhythms — {categoryName}
      </p>
      <p className="text-xs text-stone-400 leading-relaxed">
        Bricklayers who subscribed to this category will receive emails on the checked schedules.
      </p>

      {opError && <p className="text-xs text-red-500">{opError}</p>}

      {allRhythms.length === 0 ? (
        <p className="text-xs text-stone-400 italic">No rhythms defined yet — create them on the Rhythms tab.</p>
      ) : (
        <ul className="space-y-1 pt-1">
          {allRhythms.map(r => {
            const assigned = assignedIds.has(r.id)
            return (
              <li key={r.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id={`catrh-${categoryId}-${r.id}`}
                  checked={assigned}
                  onChange={() => void handleToggle(r.id, assigned)}
                  className="accent-[var(--color-primary)]"
                />
                <label
                  htmlFor={`catrh-${categoryId}-${r.id}`}
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
