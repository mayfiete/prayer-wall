import { useState, useEffect, useCallback } from 'react'
import type { FormEvent } from 'react'
import type { PrayerMeditation } from '../../../domain/entities/PrayerMeditation'
import { useContainer } from '../../context/AppContext'
import { Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react'

const ORG_ID = import.meta.env.VITE_ORG_ID as string

interface StatementsAdminProps {
  categoryId: string
  categoryName: string
}

export function StatementsAdmin({ categoryId, categoryName }: Readonly<StatementsAdminProps>) {
  const {
    getMeditations,
    createMeditation,
    updateMeditation,
    deleteMeditation,
    setMeditationActive,
  } = useContainer()

  const [statements, setStatements] = useState<PrayerMeditation[]>([])
  const [loading, setLoading] = useState(true)
  const [opError, setOpError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editBody, setEditBody] = useState('')
  const [newBody, setNewBody] = useState('')
  const [adding, setAdding] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const data = await getMeditations.execute(categoryId)
    setStatements(data)
    setLoading(false)
  }, [categoryId, getMeditations])

  useEffect(() => { void load() }, [load])

  function startEdit(stmt: PrayerMeditation) {
    setEditingId(stmt.id)
    setEditBody(stmt.body)
    setOpError('')
  }

  async function commitEdit(id: string) {
    if (!editBody.trim()) { setOpError('Meditation cannot be empty'); return }
    setOpError('')
    try {
      const updated = await updateMeditation.execute(id, { body: editBody })
      setStatements((prev) => prev.map((s) => (s.id === id ? updated : s)))
    } catch (e) {
      setOpError(e instanceof Error ? e.message : 'Update failed')
    }
    setEditingId(null)
  }

  async function handleToggle(id: string, active: boolean) {
    if (active && !globalThis.confirm('Are you sure you want to make this prayer meditation active? It will be visible to all users.')) return
    setOpError('')
    try {
      await setMeditationActive.execute(id, active)
      setStatements((prev) => prev.map((s) => (s.id === id ? { ...s, isActive: active } : s)))
    } catch (e) {
      setOpError(e instanceof Error ? e.message : 'Toggle failed')
    }
  }

  async function handleDelete(id: string) {
    if (!globalThis.confirm('Delete this prayer meditation? This cannot be undone.')) return
    setOpError('')
    try {
      await deleteMeditation.execute(id)
      setStatements((prev) => prev.filter((s) => s.id !== id))
    } catch (e) {
      setOpError(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  async function handleMoveUp(id: string) {
    const idx = statements.findIndex((s) => s.id === id)
    if (idx <= 0) return
    const reordered = [...statements]
    ;[reordered[idx - 1], reordered[idx]] = [reordered[idx], reordered[idx - 1]]
    const updated = reordered.map((s, i) => ({ ...s, displayOrder: i + 1 }))
    setStatements(updated)
    try {
      await Promise.all(updated.map((s) => updateMeditation.execute(s.id, { displayOrder: s.displayOrder })))
    } catch (e) {
      setOpError(e instanceof Error ? e.message : 'Reorder failed')
      await load()
    }
  }

  async function handleMoveDown(id: string) {
    const idx = statements.findIndex((s) => s.id === id)
    if (idx === -1 || idx >= statements.length - 1) return
    const reordered = [...statements]
    ;[reordered[idx], reordered[idx + 1]] = [reordered[idx + 1], reordered[idx]]
    const updated = reordered.map((s, i) => ({ ...s, displayOrder: i + 1 }))
    setStatements(updated)
    try {
      await Promise.all(updated.map((s) => updateMeditation.execute(s.id, { displayOrder: s.displayOrder })))
    } catch (e) {
      setOpError(e instanceof Error ? e.message : 'Reorder failed')
      await load()
    }
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!newBody.trim()) return
    setAdding(true)
    setOpError('')
    try {
      const stmt = await createMeditation.execute({
        categoryId,
        orgId: ORG_ID,
        body: newBody,
        displayOrder: statements.length + 1,
      })
      setStatements((prev) => [...prev, stmt])
      setNewBody('')
    } catch (e) {
      setOpError(e instanceof Error ? e.message : 'Create failed')
    }
    setAdding(false)
  }

  if (loading) {
    return <p className="text-xs text-stone-400 py-2 pl-4">Loading meditations…</p>
  }

  return (
    <div className="bg-stone-50 border-t border-stone-200 px-4 py-4">
      <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">
        Prayer Meditations — {categoryName}
      </h4>

      {opError && <p className="text-xs text-red-600 mb-2">{opError}</p>}

      {statements.length === 0 && (
        <p className="text-xs text-stone-400 mb-3 italic">No meditations yet. Add one below.</p>
      )}

      <ul className="space-y-2 mb-4">
        {statements.map((stmt, idx) => (
          <li
            key={stmt.id}
            className={`flex items-start gap-2 rounded-md border px-3 py-2 bg-white ${
              stmt.isActive ? 'border-stone-200' : 'border-stone-100 opacity-60'
            }`}
          >
            <div className="flex flex-col gap-0.5 pt-0.5 shrink-0">
              <button
                onClick={() => void handleMoveUp(stmt.id)}
                disabled={idx === 0}
                className="p-0.5 text-stone-300 hover:text-stone-600 disabled:opacity-20"
                aria-label="Move up"
              >
                <ChevronUp size={13} />
              </button>
              <button
                onClick={() => void handleMoveDown(stmt.id)}
                disabled={idx === statements.length - 1}
                className="p-0.5 text-stone-300 hover:text-stone-600 disabled:opacity-20"
                aria-label="Move down"
              >
                <ChevronDown size={13} />
              </button>
            </div>

            <div className="flex-1 min-w-0">
              {editingId === stmt.id ? (
                <textarea
                  autoFocus
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  onBlur={() => void commitEdit(stmt.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setEditingId(null)
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void commitEdit(stmt.id)
                  }}
                  rows={4}
                  className="w-full border border-[var(--color-primary)] rounded px-2 py-1 text-xs text-stone-800 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40 resize-y"
                />
              ) : (
                <button
                  onClick={() => startEdit(stmt)}
                  className="text-xs text-stone-700 text-left leading-relaxed hover:text-[var(--color-primary)] transition-colors w-full"
                  title="Click to edit"
                >
                  {stmt.body}
                </button>
              )}
            </div>

            <label className="flex items-center gap-1 text-[11px] text-stone-400 select-none cursor-pointer shrink-0 pt-0.5">
              <input
                type="checkbox"
                checked={stmt.isActive}
                onChange={(e) => void handleToggle(stmt.id, e.target.checked)}
                className="accent-[var(--color-primary)]"
              />
              Active
            </label>

            <button
              onClick={() => void handleDelete(stmt.id)}
              className="p-1 text-stone-300 hover:text-red-500 shrink-0"
              aria-label="Delete meditation"
            >
              <Trash2 size={13} />
            </button>
          </li>
        ))}
      </ul>

      <form onSubmit={(e) => void handleAdd(e)} className="flex flex-col gap-2">
        <textarea
          value={newBody}
          onChange={(e) => setNewBody(e.target.value)}
          placeholder={`New prayer meditation for ${categoryName}… (scripture reference + prayer text)`}
          rows={3}
          className="w-full border border-stone-300 rounded-md px-3 py-2 text-xs text-stone-800 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40 resize-y"
        />
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={adding || !newBody.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--color-primary)] text-white rounded-md text-xs font-medium hover:opacity-90 disabled:opacity-60"
          >
            <Plus size={13} />
            Add Meditation
          </button>
        </div>
      </form>
    </div>
  )
}
