import { useState, useEffect } from 'react'
import type { PrayerCategory } from '../../domain/entities/PrayerCategory'
import { useContainer } from '../context/AppContext'

export function usePrayerCategories(churchId: string) {
  const { getPrayerCategories } = useContainer()
  const [categories, setCategories] = useState<PrayerCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getPrayerCategories
      .execute(churchId)
      .then((result) => {
        if (!cancelled) setCategories(result)
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : 'Failed to load categories')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [getPrayerCategories, churchId])

  return { categories, loading, error }
}
