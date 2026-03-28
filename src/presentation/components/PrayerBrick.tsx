import { memo } from 'react'
import type { Prayer } from '../../domain/entities/Prayer'
import { PrayerHandsIcon } from './PrayerHandsIcon'
import { useTileMode } from '../context/TileModeContext'

// Full class names written out so Tailwind's content scanner detects them:
// tile-stone tile-brick
const materialClass = { stone: 'tile-stone', brick: 'tile-brick' } as const

interface PrayerBrickProps {
  prayer: Prayer
  isNew?: boolean
}

interface EmptyBrickProps {
  onClick?: () => void
  isPulsing?: boolean
}

function splitName(full: string): [string, string] {
  const trimmed = full.trim()
  const lastSpace = trimmed.lastIndexOf(' ')
  if (lastSpace === -1) return [trimmed, '']
  return [trimmed.slice(0, lastSpace), trimmed.slice(lastSpace + 1)]
}

export const PrayerBrick = memo(function PrayerBrick({ prayer, isNew = false }: PrayerBrickProps) {
  const { mode } = useTileMode()
  const [firstLine, lastLine] = splitName(prayer.name)

  return (
    <div
      className={`tile-base ${materialClass[mode]} tile-name${isNew ? ' animate-brick-in' : ''}`}
      title={prayer.name}
    >
      <span className="stone-icon" aria-hidden>✦</span>
      <span className="stone-name">
        <span className="stone-name-line">{firstLine}</span>
        {lastLine && <span className="stone-name-line">{lastLine}</span>}
      </span>
    </div>
  )
})

export const EmptyBrick = memo(function EmptyBrick({ onClick, isPulsing = false }: EmptyBrickProps) {
  const { mode } = useTileMode()

  const classes = `tile-base ${materialClass[mode]} tile-prayer${isPulsing ? ' animate-pulse-glow' : ''}`

  if (onClick) {
    return (
      <button
        type="button"
        className={classes}
        onClick={onClick}
        aria-label="Add your name to this prayer stone"
      >
        <PrayerHandsIcon className="prayer-hands-icon" />
      </button>
    )
  }

  return (
    <div className={classes} aria-hidden>
      <PrayerHandsIcon className="prayer-hands-icon" />
    </div>
  )
})
