import { memo, type ReactNode } from 'react'

interface WallBrickProps {
  name: string
  isNew?: boolean
  imageUrl?: string
}

interface WallCtaBrickProps {
  icon: ReactNode
  ariaLabel: string
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

export const WallBrick = memo(function WallBrick({ name, isNew = false, imageUrl }: WallBrickProps) {
  const [firstLine, lastLine] = splitName(name)

  return (
    <div
      className={`tile-base tile-stone tile-name${isNew ? ' animate-brick-in' : ''}`}
      title={name}
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

export const WallCtaBrick = memo(function WallCtaBrick({ icon, ariaLabel, onClick, imageUrl }: WallCtaBrickProps) {
  return (
    <button
      type="button"
      className="tile-base tile-stone tile-cta animate-pulse-glow"
      onClick={onClick}
      aria-label={ariaLabel}
      style={stoneStyle(imageUrl)}
    >
      {icon}
    </button>
  )
})
