import { useEffect } from 'react'
import type { Donation } from '../../domain/entities/Donation'
import { givingWallContainer } from '../../infrastructure/container'

export function useRealtimeDonations(
  givingWallId: string,
  onNewDonation: (donation: Donation) => void,
) {
  useEffect(() => {
    if (!givingWallId) return

    const repo = givingWallContainer.repo
    if (!('getSupabaseClient' in repo)) return

    const supabase = (repo as unknown as { getSupabaseClient: () => import('@supabase/supabase-js').SupabaseClient }).getSupabaseClient()

    const channel = supabase
      .channel(`giving-wall:${givingWallId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'prayer_wall',
          table: 'donations',
          filter: `giving_wall_id=eq.${givingWallId}`,
        },
        (payload: { new: Record<string, unknown> }) => {
          const row = payload.new
          const donation: Donation = {
            id: row.id as string,
            givingWallId: row.giving_wall_id as string,
            name: row.name as string,
            donatedAt: new Date(row.donated_at as string),
            amountCents: row.amount_cents as number,
            currency: row.currency as string,
            processorRef: (row.processor_ref as string | null) ?? null,
            emailOptOut: row.email_opt_out as boolean,
          }
          onNewDonation(donation)
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [givingWallId, onNewDonation])
}
