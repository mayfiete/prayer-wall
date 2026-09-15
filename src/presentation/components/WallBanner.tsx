import type { ReactNode } from 'react'

interface WallBannerProps {
  heading: string
  body: string
  /** Optional slot for category pills or other inline content below the body text */
  footer?: ReactNode
}

export function WallBanner({ heading, body, footer }: WallBannerProps) {
  return (
    <section
      className="min-w-0 break-words px-4 py-4 sm:px-8 sm:py-5 border-b border-stone-200"
      style={{ backgroundColor: 'var(--color-banner-bg)', color: 'var(--color-banner-text)', fontFamily: 'var(--font-banner)' }}
    >
      <h2 className="text-[15px] font-semibold mb-1" style={{ color: 'var(--color-banner-text)' }}>{heading}</h2>
      <p className="text-[13px] leading-relaxed mb-3" style={{ color: 'var(--color-banner-subtext)' }}>
        {body}
      </p>
      {footer}
    </section>
  )
}
