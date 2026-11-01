import { useState, useEffect, useCallback, useRef } from 'react'
import type { Donation } from '../../domain/entities/Donation'
import { useContainer } from '../context/AppContext'

const FETCH_RETRY_DELAYS = [500, 1000]
const NETWORK_FETCH_ERROR = /failed to fetch|fetch failed|networkerror when attempting to fetch resource|load failed/i

export function useGivingWall(givingWallId: string) {
  const { getGivingWall } = useContainer()
  const [donations, setDonations] = useState<Donation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const currentDonations = useRef(donations)
  currentDonations.current = donations

  useEffect(() => {
    let cancelled = false
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    let initialSettled = false

    setError(null)
    setDonations([])
    if (!givingWallId) {
      setLoading(false)
      return
    }
    setLoading(true)

    const load = async (attempt: number) => {
      try {
        const rows = await getGivingWall.execute(givingWallId)
        if (cancelled) return

        // Realtime may have delivered a new donation while this read was pending.
        setDonations(current => {
          const loadedIds = new Set(rows.map(row => row.id))
          return [...current.filter(row => !loadedIds.has(row.id)), ...rows]
        })
        setError(null)
        setLoading(false)
        initialSettled = true
      } catch (cause) {
        if (cancelled) return
        const message = cause instanceof Error ? cause.message : 'Could not load the giving wall.'
        const delay = FETCH_RETRY_DELAYS[attempt]
        if (delay !== undefined && NETWORK_FETCH_ERROR.test(message)) {
          retryTimer = setTimeout(() => { void load(attempt + 1) }, delay)
          return
        }
        console.error('[giving-wall] Failed to load donations', cause)
        setError(message)
        setLoading(false)
        initialSettled = true
      }
    }

    void load(0)
    // Hidden rows no longer pass Realtime RLS, so reconcile with public reads.
    let refreshing = false
    const refreshTimer = setInterval(async () => {
      if (refreshing || !initialSettled) return
      refreshing = true
      const existingIds = new Set(currentDonations.current.map(row => row.id))
      try {
        const rows = await getGivingWall.execute(givingWallId)
        if (cancelled) return
        const loadedIds = new Set(rows.map(row => row.id))
        setDonations(current => [
          ...current.filter(row => !existingIds.has(row.id) && !loadedIds.has(row.id)),
          ...rows,
        ])
        setError(null)
        setLoading(false)
      } catch {
        // Keep the displayed wall during a background network failure.
      } finally {
        refreshing = false
      }
    }, 30_000)
    return () => {
      clearInterval(refreshTimer)
      cancelled = true
      if (retryTimer !== undefined) clearTimeout(retryTimer)
    }
  }, [getGivingWall, givingWallId])

  const addDonation = useCallback((donation: Donation) => {
    setDonations((prev) => (prev.some((d) => d.id === donation.id) ? prev : [donation, ...prev]))
  }, [])

  return { donations, loading, error, addDonation }
}
