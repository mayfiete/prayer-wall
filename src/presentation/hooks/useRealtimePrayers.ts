import { useEffect } from 'react'
import type { Prayer } from '../../domain/entities/Prayer'
import { useContainer } from '../context/AppContext'

interface RealtimePrayerPayload {
  id: string
  wall_id: string
  name: string
  committed_at: string
  reminder_active: boolean
  last_reminded_at: string | null
}

function payloadToPrayer(row: RealtimePrayerPayload): Prayer {
  return {
    id: row.id,
    wallId: row.wall_id,
    name: row.name,
    committedAt: new Date(row.committed_at),
    reminderActive: row.reminder_active,
    lastRemindedAt: row.last_reminded_at ? new Date(row.last_reminded_at) : null,
  }
}

export function useRealtimePrayers(wallId: string, onNewPrayer: (prayer: Prayer) => void) {
  const { supabase } = useContainer()

  useEffect(() => {
    const channel = supabase
      .channel(`prayer-wall-${wallId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'prayer_wall',
          table: 'commitments',
          filter: `wall_id=eq.${wallId}`,
        },
        (payload) => {
          const prayer = payloadToPrayer(payload.new as unknown as RealtimePrayerPayload)
          onNewPrayer(prayer)
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [supabase, wallId, onNewPrayer])
}
