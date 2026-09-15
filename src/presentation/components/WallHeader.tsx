import type { ReactNode } from 'react'

interface WallHeaderProps {
  title: string
  orgName: string
  logoMark: ReactNode
}

export function WallHeader({ title, orgName, logoMark }: WallHeaderProps) {
  return (
    <header
      className="flex items-center gap-3 px-4 py-4 sm:gap-4 sm:px-8 sm:py-6 border-b border-stone-200"
      style={{ backgroundColor: 'var(--color-header-bg)', color: 'var(--color-header-text)', fontFamily: 'var(--font-header)' }}
    >
      {logoMark}
      <div className="min-w-0 flex-1 break-words">
        <h1
          className="text-[22px] sm:text-[26px] font-semibold leading-tight tracking-tight"
          style={{ color: 'var(--color-header-text)', fontFamily: 'var(--font-header)' }}
        >
          {title}
        </h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--color-header-subtext)' }}>{orgName}</p>
      </div>
    </header>
  )
}
