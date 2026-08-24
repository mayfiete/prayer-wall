import { useState } from 'react'
import { GivingWallGrid } from '../components/GivingWallGrid'
import { MockBanner } from '../components/MockBanner'
import { Heart } from 'lucide-react'
import { Modal } from '../components/ui/Modal'
import { LogoMark } from '../components/LogoMark'
import { WallHeader } from '../components/WallHeader'
import { WallBanner } from '../components/WallBanner'
import { useThemeVar } from '../hooks/useThemeVar'

const GIVING_WALL_ID = import.meta.env.VITE_GIVING_WALL_ID as string
const ORG_NAME = (import.meta.env.VITE_ORG_NAME as string | undefined) ?? 'Heritage Christian Academy'

export function GivingWallPage() {
  const [modalOpen, setModalOpen] = useState(false)

  const wallTitle     = useThemeVar('--wall-title',           'Giving Wall')
  const bannerHeading = useThemeVar('--text-banner-heading',  'Place your brick on the wall')
  const bannerBody    = useThemeVar('--text-banner-body',     'Support HCA with a gift and add your name to the foundation.')
  const wallCta       = useThemeVar('--text-wall-cta',        'Click the next open brick to give!')
  const modalTitle    = useThemeVar('--text-modal-title',     'Make a gift')

  return (
    <div className="min-h-screen flex flex-col bg-stone-100 font-body">
      <MockBanner />

      <WallHeader
        title={wallTitle}
        orgName={ORG_NAME}
        logoMark={<LogoMark fallbackIcon={<Heart className="w-8 h-8 text-white" />} />}
      />

      <WallBanner heading={bannerHeading} body={bannerBody} />

      <section
        className="flex-1 flex flex-col px-0 overflow-x-clip"
        style={{ backgroundColor: 'var(--color-wall-bg)' }}
      >
        <div
          className="flex items-center gap-2 text-[14px] font-semibold pt-4 pb-3 px-6"
          style={{ color: 'var(--color-wall-text)', fontFamily: 'var(--font-wall)' }}
        >
          <Heart size={14} />
          {wallCta}
        </div>
        <GivingWallGrid givingWallId={GIVING_WALL_ID} onCtaClick={() => setModalOpen(true)} />
      </section>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={modalTitle}
      >
        <div className="p-4 text-sm text-stone-600">
          {/* Payment processor embed goes here — Stripe, Justify, or Gettrx iframe/modal */}
          <p className="mb-4">Payment integration pending processor selection.</p>
          <p className="text-xs text-stone-400">Once a payment is confirmed, your brick will appear automatically via webhook.</p>
        </div>
      </Modal>
    </div>
  )
}
