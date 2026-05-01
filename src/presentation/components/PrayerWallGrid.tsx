import { useRef, useCallback, useMemo } from 'react'
import type { Prayer } from '../../domain/entities/Prayer'
import { PrayerBrick, CtaBrick } from './PrayerBrick'
import { usePrayerWall } from '../hooks/usePrayerWall'
import { useRealtimePrayers } from '../hooks/useRealtimePrayers'
import { useTileMode } from '../context/TileModeContext'
import { Loader2 } from 'lucide-react'

const STONES_PER_ROW = 7

interface PrayerWallGridProps {
  wallId: string
  onCtaClick?: () => void
}

type StoneItem =
  | { kind: 'prayer'; prayer: Prayer; isNew: boolean }
  | { kind: 'cta' }

export function PrayerWallGrid({ wallId, onCtaClick }: PrayerWallGridProps) {
  const { prayers, loading, error, addPrayer } = usePrayerWall(wallId)
  const { isChanging } = useTileMode()
  const newIdsRef = useRef<Set<string>>(new Set())

  const handleNewPrayer = useCallback(
    (prayer: Prayer) => {
      newIdsRef.current.add(prayer.id)
      addPrayer(prayer)
    },
    [addPrayer],
  )

  useRealtimePrayers(wallId, handleNewPrayer)

  const rows = useMemo(() => {
    const items: StoneItem[] = [
      ...prayers.map((p) => ({
        kind: 'prayer' as const,
        prayer: p,
        isNew: newIdsRef.current.has(p.id),
      })),
      { kind: 'cta' as const },
    ]

    const result: StoneItem[][] = []
    for (let i = 0; i < items.length; i += STONES_PER_ROW) {
      result.push(items.slice(i, i + STONES_PER_ROW))
    }
    return result
  }, [prayers])

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

  return (
    <div className={`stone-wall${isChanging ? ' tiles-changing' : ''}`}>
      {rows.map((row, rowIdx) => (
        <div
          key={rowIdx}
          className={`stone-row${rowIdx % 2 === 1 ? ' stone-row--offset' : ''}`}
        >
          {row.map((item) => {
            if (item.kind === 'prayer') {
              return (
                <PrayerBrick
                  key={item.prayer.id}
                  prayer={item.prayer}
                  isNew={item.isNew}
                />
              )
            }
            return <CtaBrick key="cta" onClick={onCtaClick} />
          })}
        </div>
      ))}
    </div>
  )
}
