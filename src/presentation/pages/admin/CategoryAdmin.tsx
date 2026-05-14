import { useState } from 'react'
import type { FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../../infrastructure/supabase/types'
import type { PrayerCategory } from '../../../domain/entities/PrayerCategory'
import { usePrayerCategoriesAdmin } from '../../hooks/usePrayerCategoriesAdmin'
import { ChevronUp, ChevronDown, Trash2, Plus } from 'lucide-react'

const ORG_ID = import.meta.env.VITE_ORG_ID as string

interface CategoryAdminProps {
  supabase: SupabaseClient<Database>
}

export function CategoryAdmin({ supabase }: CategoryAdminProps) {
  const { categories, loading, error, create, update, setActive, remove, moveUp, moveDown } =
    usePrayerCategoriesAdmin(ORG_ID, supabase)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [opError, setOpError] = useState('')

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
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return
    setOpError('')
    try {
      await remove(id)
    } catch (e) {
      setOpError(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  if (loading) return <p className="text-stone-400 text-sm py-8 text-center">Loading...</p>
  if (error) return <p className="text-red-500 text-sm py-8 text-center">{error}</p>

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h2 className="text-lg font-semibold text-stone-800">Prayer Categories</h2>

      {opError && <p className="text-sm text-red-600">{opError}</p>}

      <ul className="divide-y divide-stone-200 border border-stone-200 rounded-lg overflow-hidden">
        {sorted.map((cat, idx) => (
          <li key={cat.id} className="flex items-center gap-3 px-4 py-3 bg-white">
            <div className="flex flex-col gap-0.5">
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

            <div className="flex-1 min-w-0">
              {editingId === cat.id ? (
                <input
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={() => commitEdit(cat.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitEdit(cat.id)
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                  className="w-full border border-amber-400 rounded px-2 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              ) : (
                <button
                  onClick={() => startEdit(cat)}
                  className="text-sm text-stone-800 hover:text-amber-700 text-left w-full truncate"
                >
                  {cat.name}
                </button>
              )}
            </div>

            <label className="flex items-center gap-1.5 text-xs text-stone-500 select-none cursor-pointer">
              <input
                type="checkbox"
                checked={cat.isActive}
                onChange={(e) => setActive(cat.id, e.target.checked)}
                className="accent-amber-600"
              />
              Active
            </label>

            <button
              onClick={() => handleRemove(cat.id, cat.name)}
              className="p-1 text-stone-300 hover:text-red-500"
              aria-label={`Delete ${cat.name}`}
            >
              <Trash2 size={14} />
            </button>
          </li>
        ))}
      </ul>

      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New category name"
          className="flex-1 border border-stone-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
        <button
          type="submit"
          disabled={adding || !newName.trim()}
          className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 text-white rounded-md text-sm font-medium hover:bg-amber-700 disabled:opacity-60"
        >
          <Plus size={14} />
          Add
        </button>
      </form>
    </div>
  )
}
