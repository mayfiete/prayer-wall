import { useRef, useCallback } from 'react'
import type { Prayer } from '../../domain/entities/Prayer'
import { PrayerBrick, EmptyBrick } from './PrayerBrick'
import { usePrayerWall } from '../hooks/usePrayerWall'
import { useRealtimePrayers } from '../hooks/useRealtimePrayers'
import { useTileMode } from '../context/TileModeContext'
import { Loader2 } from 'lucide-react'

const MIN_DISPLAY_BRICKS = 48

interface PrayerWallGridProps {
  churchId: string
}

export function PrayerWallGrid({ churchId }: PrayerWallGridProps) {
  const { prayers, loading, error, addPrayer } = usePrayerWall(churchId)
  const { isChanging } = useTileMode()
  const newIdsRef = useRef<Set<string>>(new Set())

  const handleNewPrayer = useCallback(
    (prayer: Prayer) => {
      newIdsRef.current.add(prayer.id)
      addPrayer(prayer)
    },
    [addPrayer],
  )

  useRealtimePrayers(churchId, handleNewPrayer)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="animate-spin text-amber-500" size={40} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-24 text-red-400 text-sm">{error}</div>
    )
  }

  const emptyCount = Math.max(0, MIN_DISPLAY_BRICKS - prayers.length)

  return (
    <div className={`grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-1.5${isChanging ? ' tiles-changing' : ''}`}>
      {prayers.map((prayer) => (
        <PrayerBrick
          key={prayer.id}
          prayer={prayer}
          isNew={newIdsRef.current.has(prayer.id)}
        />
      ))}
      {Array.from({ length: emptyCount }).map((_, i) => (
        <EmptyBrick key={`empty-${i}`} />
      ))}
    </div>
  )
}
