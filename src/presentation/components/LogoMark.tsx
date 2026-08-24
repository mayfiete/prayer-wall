import type { ReactNode } from 'react'
import { useLogoUrl } from '../hooks/useThemeVar'

interface LogoMarkProps {
  /** Icon shown inside the fallback circle when no logo image is set */
  fallbackIcon: ReactNode
}

export function LogoMark({ fallbackIcon }: LogoMarkProps) {
  const logoUrl = useLogoUrl()
  const imageUrl = logoUrl ? logoUrl.replace(/^url\(['"']?/, '').replace(/['"']?\)$/, '') : null

  if (imageUrl) {
    return (
      <div className="w-[60px] h-[60px] rounded-full shrink-0 overflow-hidden flex items-center justify-center bg-[var(--color-header-bg)]">
        <img src={imageUrl} alt="Logo" className="w-full h-full object-contain" />
      </div>
    )
  }

  return (
    <div className="w-[60px] h-[60px] rounded-full bg-[var(--color-primary)] flex items-center justify-center shrink-0">
      {fallbackIcon}
    </div>
  )
}
