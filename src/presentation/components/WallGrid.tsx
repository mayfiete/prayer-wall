import { useMemo, Fragment, type CSSProperties, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { useWallLayout } from '../hooks/useWallLayout'

export interface WallGridItem {
  key: string
  node: ReactNode
}

interface WallGridProps {
  items: WallGridItem[]
  ctaBrick: ReactNode
  loading: boolean
  error: string | null
  /** Round the tile corners on mobile (prayer stones). Giving bricks stay square. */
  rounded?: boolean
  /** Multiplies tile height in mobile mode (1 = default). */
  mobileHeightScale?: number
  /** Moves names down in mobile mode, as a percentage of tile height (0 = default). */
  mobileNameShift?: number
}

export function WallGrid({ items, ctaBrick, loading, error, rounded = false, mobileHeightScale = 1, mobileNameShift = 0 }: WallGridProps) {
  const { containerRef, columns: stonesPerRow, mobile, style, mobileRowStyle } = useWallLayout(mobileHeightScale)
  const FULL = stonesPerRow
  const OFFSET = Math.max(1, stonesPerRow - 1)

  const rows = useMemo(() => {
    const all: WallGridItem[] = [{ key: '__cta__', node: ctaBrick }, ...items]
    const result: WallGridItem[][] = []
    let idx = 0
    let rowIdx = 0
    while (idx < all.length) {
      // Mobile: one centered stone, then two equal-sized stones, starting with the CTA.
      const size = mobile ? (rowIdx % 2 === 0 ? 1 : 2) : rowIdx % 2 === 0 ? FULL : OFFSET
      result.push(all.slice(idx, idx + size))
      idx += size
      rowIdx += 1
    }
    return result
  }, [items, ctaBrick, FULL, OFFSET, mobile])

  const rowClass = (rowIdx: number) => {
    if (mobile) {
      return ' stone-row--mobile'
    }
    return stonesPerRow > 1 && rowIdx % 2 === 1 ? ' stone-row--offset' : ''
  }

  return (
    <div ref={containerRef} className="min-w-0 w-full flex-1">
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="animate-spin text-amber-500" size={40} />
        </div>
      ) : error ? (
        <div className="flex items-center justify-center py-24 text-red-400 text-sm">{error}</div>
      ) : (
        <div className={`stone-wall${rounded ? ' stone-wall--rounded' : ''}`} style={style}>
          {rows.map((row, rowIdx) => (
            <div
              key={rowIdx}
              className={`stone-row${rowClass(rowIdx)}`}
              style={mobile ? { ...mobileRowStyle(), '--mobile-name-shift': mobileNameShift } as CSSProperties : undefined}
            >
              {row.map((item) => (
                <Fragment key={item.key}>{item.node}</Fragment>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
