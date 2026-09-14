import { useState, useEffect, useCallback } from 'react'
import type { Donation } from '../../domain/entities/Donation'
import { useContainer } from '../context/AppContext'

const FETCH_RETRY_DELAYS = [500, 1000]
const NETWORK_FETCH_ERROR = /failed to fetch|fetch failed|networkerror when attempting to fetch resource|load failed/i

export function useGivingWall(givingWallId: string) {
  const { getGivingWall } = useContainer()
  const [donations, setDonations] = useState<Donation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let retryTimer: ReturnType<typeof setTimeout> | undefined

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
      }
    }

    void load(0)
    return () => {
      cancelled = true
      if (retryTimer !== undefined) clearTimeout(retryTimer)
    }
  }, [getGivingWall, givingWallId])

  const addDonation = useCallback((donation: Donation) => {
    setDonations((prev) => (prev.some((d) => d.id === donation.id) ? prev : [donation, ...prev]))
  }, [])

  return { donations, loading, error, addDonation }
}
