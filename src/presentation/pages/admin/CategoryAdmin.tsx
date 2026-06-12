import { useState } from 'react'
import type { FormEvent } from 'react'
import type { PrayerCategory } from '../../../domain/entities/PrayerCategory'
import { usePrayerCategoriesAdmin } from '../../hooks/usePrayerCategoriesAdmin'
import { StatementsAdmin } from './StatementsAdmin'
import { ChevronUp, ChevronDown, ChevronRight, Trash2, Plus, BookOpen } from 'lucide-react'

const ORG_ID = import.meta.env.VITE_ORG_ID as string

export function CategoryAdmin() {
  const { categories, loading, error, create, update, setActive, remove, moveUp, moveDown } =
    usePrayerCategoriesAdmin(ORG_ID)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [opError, setOpError] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const sorted = [...categories].sort((a, b) => a.displayOrder - b.displayOrder)

  function startEdit(cat: PrayerCategory) {
    setEditingId(cat.id)
    setEditName(cat.name)
    setOpError('')
  }

  async function commitEdit(id: string) {
    if (!editName.trim()) {
      setOpError('Name cannot be empty')
      return
    }
    setOpError('')
    try {
      await update(id, editName)
    } catch (e) {
      setOpError(e instanceof Error ? e.message : 'Update failed')
    }
    setEditingId(null)
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setAdding(true)
    setOpError('')
    try {
      await create(newName)
      setNewName('')
    } catch (e) {
      setOpError(e instanceof Error ? e.message : 'Create failed')
    }
    setAdding(false)
  }

  async function handleRemove(id: string, name: string) {
    if (!globalThis.confirm(`Delete "${name}"? This cannot be undone.`)) return
    setOpError('')
    try {
      await remove(id)
      if (expandedId === id) setExpandedId(null)
    } catch (e) {
      setOpError(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  if (loading) return <p className="text-stone-400 text-sm py-8 text-center">Loading...</p>
  if (error) return <p className="text-red-500 text-sm py-8 text-center">{error}</p>

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[var(--color-heading)]">Prayer Categories</h2>
        <p className="text-xs text-stone-400 mt-0.5">
          Click a category name to rename it. Click <BookOpen size={11} className="inline" /> to manage its prayer meditations.
        </p>
      </div>

      {opError && <p className="text-sm text-red-600">{opError}</p>}

      <div className="border border-stone-200 rounded-lg overflow-hidden divide-y divide-stone-200">
        {sorted.map((cat, idx) => (
          <div key={cat.id} className="bg-white">
            {/* Category row */}
            <div className="flex items-center gap-3 px-4 py-3">
              {/* Reorder */}
              <div className="flex flex-col gap-0.5 shrink-0">
                <button
                  onClick={() => moveUp(cat.id)}
                  disabled={idx === 0}
                  className="p-0.5 text-stone-400 hover:text-stone-700 disabled:opacity-20"
                  aria-label="Move up"
                >
                  <ChevronUp size={14} />
                </button>
                <button
                  onClick={() => moveDown(cat.id)}
                  disabled={idx === sorted.length - 1}
                  className="p-0.5 text-stone-400 hover:text-stone-700 disabled:opacity-20"
                  aria-label="Move down"
                >
                  <ChevronDown size={14} />
                </button>
              </div>

              {/* Name / edit */}
              <div className="flex-1 min-w-0">
                {editingId === cat.id ? (
                  <input
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={() => void commitEdit(cat.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void commitEdit(cat.id)
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                    className="w-full border border-[var(--color-primary)] rounded px-2 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40"
                  />
                ) : (
                  <button
                    onClick={() => startEdit(cat)}
                    className={`text-sm text-left w-full truncate font-medium ${cat.isActive ? 'text-stone-800 hover:text-[var(--color-primary)]' : 'text-stone-400 line-through hover:text-stone-600'}`}
                    title="Click to rename"
                  >
                    {cat.name}
                  </button>
                )}
              </div>

              {/* Active checkbox */}
              <label className="flex items-center gap-1.5 text-xs text-stone-500 select-none cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={cat.isActive}
                  onChange={(e) => {
                    const next = e.target.checked
                    if (next && !globalThis.confirm(`Are you sure you want to make "${cat.name}" active? It will appear on the prayer wall.`)) return
                    setActive(cat.id, next)
                  }}
                  className="accent-[var(--color-primary)]"
                />
                Active
              </label>

              {/* Expand meditations */}
              <button
                onClick={() => setExpandedId(expandedId === cat.id ? null : cat.id)}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors shrink-0 ${
                  expandedId === cat.id
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                }`}
                title="Manage prayer meditations"
              >
                <BookOpen size={12} />
                Meditations
                <ChevronRight
                  size={12}
                  className={`transition-transform ${expandedId === cat.id ? 'rotate-90' : ''}`}
                />
              </button>

              {/* Delete */}
              <button
                onClick={() => void handleRemove(cat.id, cat.name)}
                className="p-1 text-stone-300 hover:text-red-500 shrink-0"
                aria-label={`Delete ${cat.name}`}
              >
                <Trash2 size={14} />
              </button>
            </div>

            {/* Meditations panel — expanded inline */}
            {expandedId === cat.id && (
              <StatementsAdmin
                categoryId={cat.id}
                categoryName={cat.name}
              />
            )}
          </div>
        ))}
      </div>

      <form onSubmit={(e) => void handleAdd(e)} className="flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New category name"
          className="flex-1 border border-stone-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40"
        />
        <button
          type="submit"
          disabled={adding || !newName.trim()}
          className="flex items-center gap-1.5 px-4 py-2 bg-[var(--color-primary)] text-white rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-60"
        >
          <Plus size={14} />
          Add Category
        </button>
      </form>
    </div>
  )
}
