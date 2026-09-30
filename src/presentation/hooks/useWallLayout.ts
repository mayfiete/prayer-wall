import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'

export function useWallLayout() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [layout, setLayout] = useState({ columns: 1, width: 200, height: 100, overlapX: 0, overlapY: 0, mobile: false })

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return

    const update = () => {
      const theme = getComputedStyle(document.documentElement)
      const read = (key: string, fallback: number) => {
        const value = parseFloat(theme.getPropertyValue(key))
        return Number.isFinite(value) ? value : fallback
      }
      const available = Math.max(1, container.clientWidth - 2 * read('--stone-screen-padding', 20))
      const mobile = container.clientWidth < 640
      const maximum = Math.max(1, Math.floor(read('--stones-per-row', 5)))
      const scale = Math.max(0.25, read('--stone-scale', 1))
      const aspect = Math.max(0.2, read('--stone-aspect', 0.5))
      const maxWidth = 600 * scale
      // Keep enough space between names, even with a dense desktop theme.
      const minimumStep = Math.max(80, 96 * scale)
      const overlapX = mobile
        ? Math.max(0, Math.min(read('--stone-overlap-x', 149), available * 0.16))
        : Math.max(0, Math.min(read('--stone-overlap-x', 149), available / 2, maxWidth / 2))
      const columns = mobile ? 3 : Math.max(1, Math.min(maximum, Math.floor((available - overlapX) / minimumStep)))
      const fittedWidth = (available + overlapX * (columns - 1)) / columns
      // Phone rows fill the wall independently of the desktop stone-size setting.
      const width = Math.floor(mobile ? fittedWidth : Math.min(maxWidth, fittedWidth))
      const height = Math.max(1, Math.round(width * aspect))
      const overlapY = Math.max(0, Math.min(read('--stone-overlap-y', 67), height / 2))
      setLayout(previous => {
        if (previous.columns === columns && previous.width === width && previous.height === height &&
            previous.overlapX === overlapX && previous.overlapY === overlapY && previous.mobile === mobile) return previous
        return { columns, width, height, overlapX, overlapY, mobile }
      })
    }

    update()
    const resize = new ResizeObserver(update)
    resize.observe(container)
    const theme = new MutationObserver(update)
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] })
    return () => { resize.disconnect(); theme.disconnect() }
  }, [])

  const style = {
    '--stone-w': `${layout.width}px`,
    '--stone-h': `${layout.height}px`,
    ...(layout.mobile ? { '--wall-name-size': `${Math.max(10, Math.min(14, layout.width * 0.085))}px` } : {}),
    '--stone-overlap-x': `${layout.overlapX}px`,
    '--stone-overlap-y': `${layout.overlapY}px`,
  } as CSSProperties

  return { containerRef, columns: layout.columns, mobile: layout.mobile, style }
}
