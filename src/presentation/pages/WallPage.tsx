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
      <svg viewBox="0 0 40 40" width="38" height="38" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <polygon points="20,4 36,34 4,34" stroke="#fff" strokeWidth="2" fill="none" />
        <polygon points="20,10 30,28 10,28" fill="rgba(255,255,255,0.35)" />
      </svg>
    </div>
  )
}

export function WallPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const { categories } = usePrayerCategories(ORG_ID)
  const [wallTitle, setWallTitle] = useState(
    () => getComputedStyle(document.documentElement).getPropertyValue('--wall-title').trim() || 'Prayer Foundation'
  )

  useEffect(() => {
    const obs = new MutationObserver(() => {
      const t = getComputedStyle(document.documentElement).getPropertyValue('--wall-title').trim()
      if (t) setWallTitle(t)
    })
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] })
    return () => obs.disconnect()
  }, [])

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
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-muted)' }}>{ORG_NAME}</p>
        </div>
      </header>

      <section
        className="px-8 py-5 border-b border-stone-200"
        style={{ backgroundColor: 'var(--color-banner-bg)', color: 'var(--color-banner-text)', fontFamily: 'var(--font-banner)' }}
      >
        <h2 className="text-[15px] font-semibold mb-1" style={{ color: 'var(--color-banner-text)' }}>Add your name to the wall</h2>
        <p className="text-[13px] leading-relaxed mb-3" style={{ color: 'var(--color-muted)' }}>
          Commit to pray for one or more areas and place your stone on the foundation.
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
          Click the next open stone to join
        </div>
        <PrayerWallGrid wallId={WALL_ID} onCtaClick={() => setModalOpen(true)} />
      </section>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Commit to pray"
      >
        <CommitmentForm
          wallId={WALL_ID}
          orgId={ORG_ID}
          categories={categories}
          onSuccess={() => setModalOpen(false)}
        />
      </Modal>
    </div>
  )
}
