import { useState, useEffect, useCallback } from 'react'
import type { PrayerCategory } from '../../domain/entities/PrayerCategory'
import { useContainer } from '../context/AppContext'

export interface UsePrayerCategoriesAdminResult {
  categories: PrayerCategory[]
  loading: boolean
  error: string | null
  create: (name: string) => Promise<void>
  update: (id: string, name: string) => Promise<void>
  setActive: (id: string, active: boolean) => Promise<void>
  remove: (id: string) => Promise<void>
  moveUp: (id: string) => Promise<void>
  moveDown: (id: string) => Promise<void>
}

export function usePrayerCategoriesAdmin(orgId: string): UsePrayerCategoriesAdminResult {
  const {
    getAllPrayerCategories,
    createPrayerCategory,
    updatePrayerCategory,
    setCategoryActive,
    deletePrayerCategory,
  } = useContainer()

  const [categories, setCategories] = useState<PrayerCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const all = await getAllPrayerCategories.execute(orgId)
      setCategories(all)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load categories')
    } finally {
      setLoading(false)
    }
  }, [getAllPrayerCategories, orgId])

  useEffect(() => {
    void load()
  }, [load])

  const create = useCallback(
    async (name: string) => {
      const maxOrder = categories.reduce((m, c) => Math.max(m, c.displayOrder), 0)
      const created = await createPrayerCategory.execute({
        orgId,
        name,
        displayOrder: maxOrder + 1,
      })
      setCategories((prev) => [...prev, created])
    },
    [categories, createPrayerCategory, orgId],
  )

  const update = useCallback(
    async (id: string, name: string) => {
      const updated = await updatePrayerCategory.execute(id, { name })
      setCategories((prev) => prev.map((c) => (c.id === id ? updated : c)))
    },
    [updatePrayerCategory],
  )

  const setActive = useCallback(
    async (id: string, active: boolean) => {
      await setCategoryActive.execute(id, active)
      setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, isActive: active } : c)))
    },
    [setCategoryActive],
  )

  const remove = useCallback(
    async (id: string) => {
      await deletePrayerCategory.execute(id)
      setCategories((prev) => prev.filter((c) => c.id !== id))
    },
    [deletePrayerCategory],
  )

  const moveUp = useCallback(
    async (id: string) => {
      const sorted = [...categories].sort((a, b) => a.displayOrder - b.displayOrder)
      const idx = sorted.findIndex((c) => c.id === id)
      if (idx <= 0) return
      const above = sorted[idx - 1]
      const current = sorted[idx]

      await Promise.all([
        updatePrayerCategory.execute(current.id, { displayOrder: above.displayOrder }),
        updatePrayerCategory.execute(above.id, { displayOrder: current.displayOrder }),
      ])

      setCategories((prev) =>
        prev.map((c) => {
          if (c.id === current.id) return { ...c, displayOrder: above.displayOrder }
          if (c.id === above.id) return { ...c, displayOrder: current.displayOrder }
          return c
        }),
      )
    },
    [categories, updatePrayerCategory],
  )

  const moveDown = useCallback(
    async (id: string) => {
      const sorted = [...categories].sort((a, b) => a.displayOrder - b.displayOrder)
      const idx = sorted.findIndex((c) => c.id === id)
      if (idx === -1 || idx >= sorted.length - 1) return
      const below = sorted[idx + 1]
      const current = sorted[idx]

      await Promise.all([
        updatePrayerCategory.execute(current.id, { displayOrder: below.displayOrder }),
        updatePrayerCategory.execute(below.id, { displayOrder: current.displayOrder }),
      ])

      setCategories((prev) =>
        prev.map((c) => {
          if (c.id === current.id) return { ...c, displayOrder: below.displayOrder }
          if (c.id === below.id) return { ...c, displayOrder: current.displayOrder }
          return c
        }),
      )
    },
    [categories, updatePrayerCategory],
  )

  return { categories, loading, error, create, update, setActive, remove, moveUp, moveDown }
}
