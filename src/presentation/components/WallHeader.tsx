import type { ReactNode } from 'react'

interface WallHeaderProps {
  title: string
  orgName: string
  logoMark: ReactNode
}

export function WallHeader({ title, orgName, logoMark }: WallHeaderProps) {
  return (
    <header
      className="flex items-center gap-4 px-8 py-6 border-b border-stone-200"
      style={{ backgroundColor: 'var(--color-header-bg)', color: 'var(--color-header-text)', fontFamily: 'var(--font-header)' }}
    >
      {logoMark}
      <div className="flex-1">
        <h1
          className="text-[26px] font-semibold leading-tight tracking-tight"
          style={{ color: 'var(--color-header-text)', fontFamily: 'var(--font-header)' }}
        >
          {title}
        </h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--color-header-subtext)' }}>{orgName}</p>
      </div>
    </header>
  )
}
