import { useRef, useCallback, useMemo } from 'react'
import { PrayerHandsIcon } from './PrayerHandsIcon'
import { WallBrick, WallCtaBrick } from './WallBrick'
import { WallGrid, type WallGridItem } from './WallGrid'
import { usePrayerWall } from '../hooks/usePrayerWall'
import { useRealtimePrayers } from '../hooks/useRealtimePrayers'
import type { Prayer } from '../../domain/entities/Prayer'

interface PrayerWallGridProps {
  wallId: string
  onCtaClick?: () => void
}

export function PrayerWallGrid({ wallId, onCtaClick }: PrayerWallGridProps) {
  const { prayers, loading, error, addPrayer } = usePrayerWall(wallId)
  const newIdsRef = useRef<Set<string>>(new Set())

  const handleNewPrayer = useCallback(
    (prayer: Prayer) => {
      newIdsRef.current.add(prayer.id)
      addPrayer(prayer)
    },
    [addPrayer],
  )

  useRealtimePrayers(wallId, handleNewPrayer)

  const items = useMemo<WallGridItem[]>(
    () =>
      prayers.map((p) => ({
        key: p.id,
        node: <WallBrick name={p.name} isNew={newIdsRef.current.has(p.id)} />,
      })),
    [prayers],
  )

  const ctaBrick = useMemo(
    () => (
      <WallCtaBrick
        icon={<PrayerHandsIcon className="prayer-hands-icon" />}
        ariaLabel="Add your name to the prayer wall"
        onClick={onCtaClick}
      />
    ),
    [onCtaClick],
  )

  return <WallGrid items={items} ctaBrick={ctaBrick} loading={loading} error={error} />
}
