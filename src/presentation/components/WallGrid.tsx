import { useMemo, Fragment, type ReactNode } from 'react'
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
}

export function WallGrid({ items, ctaBrick, loading, error }: WallGridProps) {
  const { containerRef, columns: stonesPerRow, style } = useWallLayout()
  const FULL = stonesPerRow
  const OFFSET = Math.max(1, stonesPerRow - 1)

  const rows = useMemo(() => {
    const all: WallGridItem[] = [{ key: '__cta__', node: ctaBrick }, ...items]
    const result: WallGridItem[][] = []
    let idx = 0
    let rowIdx = 0
    while (idx < all.length) {
      const size = rowIdx % 2 === 0 ? FULL : OFFSET
      result.push(all.slice(idx, idx + size))
      idx += size
      rowIdx += 1
    }
    return result
  }, [items, ctaBrick, FULL, OFFSET])

  return (
    <div ref={containerRef} className="min-w-0 w-full flex-1">
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="animate-spin text-amber-500" size={40} />
        </div>
      ) : error ? (
        <div className="flex items-center justify-center py-24 text-red-400 text-sm">{error}</div>
      ) : (
        <div className="stone-wall" style={style}>
          {rows.map((row, rowIdx) => (
            <div
              key={rowIdx}
              className={`stone-row${stonesPerRow > 1 && rowIdx % 2 === 1 ? ' stone-row--offset' : ''}`}
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
