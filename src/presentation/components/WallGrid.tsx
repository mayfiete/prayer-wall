import { useMemo, useState, useEffect, Fragment, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

function useStonesPerRow(): number {
  const read = () => {
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--stones-per-row').trim()
    const n = parseInt(raw, 10)
    return isNaN(n) || n < 1 ? 5 : n
  }
  const [n, setN] = useState(read)
  useEffect(() => {
    const obs = new MutationObserver(() => setN(read))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] })
    return () => obs.disconnect()
  }, [])
  return n
}

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
  const stonesPerRow = useStonesPerRow()
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
    <div className="stone-wall">
      {rows.map((row, rowIdx) => (
        <div
          key={rowIdx}
          className={`stone-row${rowIdx % 2 === 1 ? ' stone-row--offset' : ''}`}
        >
          {row.map((item) => (
            <Fragment key={item.key}>{item.node}</Fragment>
          ))}
        </div>
      ))}
    </div>
  )
}
