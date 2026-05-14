import { useState, useEffect, useCallback } from 'react'
import type { Prayer } from '../../domain/entities/Prayer'
import { useContainer } from '../context/AppContext'

export function usePrayerWall(wallId: string) {
  const { getPrayerWall } = useContainer()
  const [prayers, setPrayers] = useState<Prayer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const result = await getPrayerWall.execute(wallId)
      setPrayers(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load prayer wall')
    } finally {
      setLoading(false)
    }
  }, [getPrayerWall, wallId])

  useEffect(() => {
    void load()
  }, [load])

  const addPrayer = useCallback((prayer: Prayer) => {
    setPrayers((prev) => {
      if (prev.some((p) => p.id === prayer.id)) return prev
      return [...prev, prayer]
    })
  }, [])

  return { prayers, loading, error, addPrayer, reload: load }
}
