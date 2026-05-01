import { useState, useEffect, useCallback, useRef } from 'react'
import type { PrayerCategory } from '../../domain/entities/PrayerCategory'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../infrastructure/supabase/types'
import { SupabasePrayerCategoryRepository } from '../../infrastructure/repositories/SupabasePrayerCategoryRepository'

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

export function usePrayerCategoriesAdmin(
  orgId: string,
  supabase: SupabaseClient<Database>,
): UsePrayerCategoriesAdminResult {
  const [categories, setCategories] = useState<PrayerCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const repoRef = useRef(new SupabasePrayerCategoryRepository(supabase))

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const all = await repoRef.current.findAllByOrg(orgId)
      setCategories(all)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load categories')
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => {
    load()
  }, [load])

  const create = useCallback(
    async (name: string) => {
      const maxOrder = categories.reduce((m, c) => Math.max(m, c.displayOrder), 0)
      const created = await repoRef.current.create({
        orgId,
        name,
        displayOrder: maxOrder + 1,
      })
      setCategories((prev) => [...prev, created])
    },
    [categories, orgId],
  )

  const update = useCallback(async (id: string, name: string) => {
    const updated = await repoRef.current.update(id, { name })
    setCategories((prev) => prev.map((c) => (c.id === id ? updated : c)))
  }, [])

  const setActive = useCallback(async (id: string, active: boolean) => {
    await repoRef.current.setActive(id, active)
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, isActive: active } : c)))
  }, [])

  const remove = useCallback(async (id: string) => {
    await repoRef.current.delete(id)
    setCategories((prev) => prev.filter((c) => c.id !== id))
  }, [])

  const moveUp = useCallback(async (id: string) => {
    const sorted = [...categories].sort((a, b) => a.displayOrder - b.displayOrder)
    const idx = sorted.findIndex((c) => c.id === id)
    if (idx <= 0) return
    const above = sorted[idx - 1]
    const current = sorted[idx]

    await Promise.all([
      repoRef.current.update(current.id, { displayOrder: above.displayOrder }),
      repoRef.current.update(above.id, { displayOrder: current.displayOrder }),
    ])

    setCategories((prev) =>
      prev.map((c) => {
        if (c.id === current.id) return { ...c, displayOrder: above.displayOrder }
        if (c.id === above.id) return { ...c, displayOrder: current.displayOrder }
        return c
      }),
    )
  }, [categories])

  const moveDown = useCallback(async (id: string) => {
    const sorted = [...categories].sort((a, b) => a.displayOrder - b.displayOrder)
    const idx = sorted.findIndex((c) => c.id === id)
    if (idx === -1 || idx >= sorted.length - 1) return
    const below = sorted[idx + 1]
    const current = sorted[idx]

    await Promise.all([
      repoRef.current.update(current.id, { displayOrder: below.displayOrder }),
      repoRef.current.update(below.id, { displayOrder: current.displayOrder }),
    ])

    setCategories((prev) =>
      prev.map((c) => {
        if (c.id === current.id) return { ...c, displayOrder: below.displayOrder }
        if (c.id === below.id) return { ...c, displayOrder: current.displayOrder }
        return c
      }),
    )
  }, [categories])

  return { categories, loading, error, create, update, setActive, remove, moveUp, moveDown }
}
