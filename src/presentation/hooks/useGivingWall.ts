import { useState, useEffect, useCallback } from 'react'
import type { Donation } from '../../domain/entities/Donation'
import { givingWallContainer } from '../../infrastructure/container'

export function useGivingWall(givingWallId: string) {
  const [donations, setDonations] = useState<Donation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!givingWallId) {
      setLoading(false)
      return
    }
    setLoading(true)
    givingWallContainer.repo
      .findAllByWall(givingWallId)
      .then(setDonations)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [givingWallId])

  const addDonation = useCallback((donation: Donation) => {
    setDonations(prev => [donation, ...prev])
  }, [])

  return { donations, loading, error, addDonation }
}
