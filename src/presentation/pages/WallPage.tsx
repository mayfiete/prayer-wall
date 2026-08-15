import { useState, useEffect } from 'react'
import { PrayerWallGrid } from '../components/PrayerWallGrid'
import { MockBanner } from '../components/MockBanner'
import { BookOpen } from 'lucide-react'
import { Modal } from '../components/ui/Modal'
import { CommitmentForm } from '../components/CommitmentForm'
import { usePrayerCategories } from '../hooks/usePrayerCategories'

const WALL_ID = import.meta.env.VITE_WALL_ID as string
const ORG_ID = import.meta.env.VITE_ORG_ID as string
const ORG_NAME = (import.meta.env.VITE_ORG_NAME as string | undefined) ?? 'Heritage Christian Academy'

function useThemeVar(varName: string, fallback: string): string {
  const [val, setVal] = useState(
    () => getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || fallback
  )
  useEffect(() => {
    const obs = new MutationObserver(() => {
      const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
      if (v) setVal(v)
    })
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] })
    return () => obs.disconnect()
  }, [varName])
  return val
}

function useLogoUrl() {
  const [logoUrl, setLogoUrl] = useState<string>(
    () => getComputedStyle(document.documentElement).getPropertyValue('--logo-url').trim()
  )
  useEffect(() => {
    const obs = new MutationObserver(() => {
      const val = getComputedStyle(document.documentElement).getPropertyValue('--logo-url').trim()
      setLogoUrl(val)
    })
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] })
    return () => obs.disconnect()
  }, [])
  return logoUrl
}

function LogoMark() {
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
      <svg viewBox="0 0 48 48" width="40" height="40" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        {/* Circle arc over the peaks */}
        <path d="M9 26 A15 15 0 0 1 39 26" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
        {/* Birds */}
        <path d="M30 12 q1.4 -1.4 2.8 0 q1.4 -1.4 2.8 0" fill="none" stroke="#fff" strokeWidth="1" strokeLinecap="round" />
        {/* Mountain peaks */}
        <polygon points="19,11 28,30 10,30" fill="rgba(255,255,255,0.35)" stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
        <polygon points="30,16 39,30 21,30" fill="none" stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
        {/* Open book */}
        <path d="M8 32 C15 29 21 31 24 33 C27 31 33 29 40 32 L40 37 C33 34 27 36 24 38 C21 36 15 34 8 37 Z" fill="#fff" />
        <path d="M24 33 L24 38" stroke="var(--color-primary)" strokeWidth="1.2" />
      </svg>
    </div>
  )
}

export function WallPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const { categories } = usePrayerCategories(ORG_ID)
  const wallTitle       = useThemeVar('--wall-title',           'Prayer Foundation')
  const bannerHeading   = useThemeVar('--text-banner-heading',  'Add your name to the wall')
  const bannerBody      = useThemeVar('--text-banner-body',     'Commit to pray for one or more areas of need and place your stone on the foundation.')
  const wallCta         = useThemeVar('--text-wall-cta',        'Click the next open stone to join!')
  const modalTitle      = useThemeVar('--text-modal-title',     'Commit to pray')
  const successHeading  = useThemeVar('--text-success-heading', 'Your stone has been placed!')
  const successBody     = useThemeVar('--text-success-body',    'You will receive weekly prayer reminders by email.')
  const submitButton    = useThemeVar('--text-submit-button',   'Add my stone to the foundation!')

  return (
    <div className="min-h-screen flex flex-col bg-stone-100 font-body">
      <MockBanner />

      <header
        className="flex items-center gap-4 px-8 py-6 border-b border-stone-200"
        style={{ backgroundColor: 'var(--color-header-bg)', color: 'var(--color-header-text)', fontFamily: 'var(--font-header)' }}
      >
        <LogoMark />
        <div className="flex-1">
          <h1 className="text-[26px] font-semibold leading-tight tracking-tight" style={{ color: 'var(--color-header-text)', fontFamily: 'var(--font-header)' }}>{wallTitle}</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-header-subtext)' }}>{ORG_NAME}</p>
        </div>
      </header>

      <section
        className="px-8 py-5 border-b border-stone-200"
        style={{ backgroundColor: 'var(--color-banner-bg)', color: 'var(--color-banner-text)', fontFamily: 'var(--font-banner)' }}
      >
        <h2 className="text-[15px] font-semibold mb-1" style={{ color: 'var(--color-banner-text)' }}>{bannerHeading}</h2>
        <p className="text-[13px] leading-relaxed mb-3" style={{ color: 'var(--color-banner-subtext)' }}>
          {bannerBody}
        </p>
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <span
                key={cat.id}
                className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border border-[#d9d9d9]"
                style={{ backgroundColor: 'color-mix(in srgb, var(--color-banner-bg) 85%, #000)', color: 'var(--color-banner-text)' }}
              >
                {cat.name}
              </span>
            ))}
          </div>
        )}
      </section>

      <section
        className="flex-1 flex flex-col px-0 overflow-x-clip"
        style={{ backgroundColor: 'var(--color-wall-bg)' }}
      >
        <div
          className="flex items-center gap-2 text-[14px] font-semibold pt-4 pb-3 px-6"
          style={{ color: 'var(--color-wall-text)', fontFamily: 'var(--font-wall)' }}
        >
          <BookOpen size={14} />
          {wallCta}
        </div>
        <PrayerWallGrid wallId={WALL_ID} onCtaClick={() => setModalOpen(true)} />
      </section>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={modalTitle}
      >
        <CommitmentForm
          wallId={WALL_ID}
          orgId={ORG_ID}
          categories={categories}
          onSuccess={() => setModalOpen(false)}
          successHeading={successHeading}
          successBody={successBody}
          submitLabel={submitButton}
        />
      </Modal>
    </div>
  )
}
