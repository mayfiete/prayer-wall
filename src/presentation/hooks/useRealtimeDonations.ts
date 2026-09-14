import { useEffect } from 'react'
import type { Donation } from '../../domain/entities/Donation'
import { useContainer } from '../context/AppContext'

interface RealtimeDonationPayload {
  id: string
  giving_wall_id: string
  name: string
  amount_cents: number
  currency: string
  processor_ref: string | null
  email_opt_out: boolean
  donated_at: string
  // email is never present — column-level grants hide it from anon clients
}

function payloadToDonation(row: RealtimeDonationPayload): Donation {
  return {
    id: row.id,
    givingWallId: row.giving_wall_id,
    name: row.name,
    donatedAt: new Date(row.donated_at),
    amountCents: row.amount_cents,
    currency: row.currency,
    processorRef: row.processor_ref ?? null,
    emailOptOut: row.email_opt_out,
  }
}

export function useRealtimeDonations(
  givingWallId: string,
  onNewDonation: (donation: Donation) => void,
) {
  const { supabase } = useContainer()

  useEffect(() => {
    if (!givingWallId) return

    const channel = supabase
      .channel(`giving-wall-${givingWallId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'prayer_wall',
          table: 'donations',
          filter: `giving_wall_id=eq.${givingWallId}`,
        },
        (payload) => {
          onNewDonation(payloadToDonation(payload.new as unknown as RealtimeDonationPayload))
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [supabase, givingWallId, onNewDonation])
}
