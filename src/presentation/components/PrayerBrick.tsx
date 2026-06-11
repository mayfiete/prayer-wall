import { memo } from 'react'
import type { Prayer } from '../../domain/entities/Prayer'
import { PrayerHandsIcon } from './PrayerHandsIcon'

interface PrayerBrickProps {
  prayer: Prayer
  isNew?: boolean
  imageUrl?: string
}

interface EmptyBrickProps {
  /** When provided, this stone is the next-available CTA */
  onClick?: () => void
  imageUrl?: string
}

function splitName(full: string): [string, string] {
  const trimmed = full.trim()
  const lastSpace = trimmed.lastIndexOf(' ')
  if (lastSpace === -1) return [trimmed, '']
  return [trimmed.slice(0, lastSpace), trimmed.slice(lastSpace + 1)]
}

function stoneStyle(imageUrl?: string): React.CSSProperties | undefined {
  return imageUrl ? { backgroundImage: `url(${imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined
}

export const PrayerBrick = memo(function PrayerBrick({ prayer, isNew = false, imageUrl }: PrayerBrickProps) {
  const [firstLine, lastLine] = splitName(prayer.name)

  return (
    <div
      className={`tile-base tile-stone tile-name${isNew ? ' animate-brick-in' : ''}`}
      title={prayer.name}
      style={stoneStyle(imageUrl)}
    >
      <span className="stone-rule" aria-hidden />
      <span className="stone-name">
        <span className="stone-name-line">{firstLine}</span>
        {lastLine && <span className="stone-name-line">{lastLine}</span>}
      </span>
    </div>
  )
})

export const CtaBrick = memo(function CtaBrick({ onClick, imageUrl }: EmptyBrickProps) {
  return (
    <button
      type="button"
      className={`tile-base tile-stone tile-cta animate-pulse-glow`}
      onClick={onClick}
      aria-label="Add your name to the prayer wall"
      style={stoneStyle(imageUrl)}
    >
      <PrayerHandsIcon className="prayer-hands-icon" />
    </button>
  )
})

