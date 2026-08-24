import { memo } from 'react'
import type { Donation } from '../../domain/entities/Donation'
import { Heart } from 'lucide-react'

interface DonationBrickProps {
  donation: Donation
  isNew?: boolean
  imageUrl?: string
}

interface DonationCtaBrickProps {
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
  return imageUrl
    ? { backgroundImage: `url(${imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : undefined
}

export const DonationBrick = memo(function DonationBrick({ donation, isNew = false, imageUrl }: DonationBrickProps) {
  const [firstLine, lastLine] = splitName(donation.name)

  return (
    <div
      className={`tile-base tile-stone tile-name${isNew ? ' animate-brick-in' : ''}`}
      title={donation.name}
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

export const DonationCtaBrick = memo(function DonationCtaBrick({ onClick, imageUrl }: DonationCtaBrickProps) {
  return (
    <button
      type="button"
      className="tile-base tile-stone tile-cta animate-pulse-glow"
      onClick={onClick}
      aria-label="Place your brick on the giving wall"
      style={stoneStyle(imageUrl)}
    >
      <Heart className="w-6 h-6 text-white opacity-80" />
    </button>
  )
})
