import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { GivingWallGrid } from '../components/GivingWallGrid'
import { MockBanner } from '../components/MockBanner'
import { Heart } from 'lucide-react'
import { Modal } from '../components/ui/Modal'
import { LogoMark } from '../components/LogoMark'
import { WallHeader } from '../components/WallHeader'
import { WallBanner } from '../components/WallBanner'
import { DonationCheckout } from '../components/DonationCheckout'
import { useThemeText } from '../hooks/useThemeText'
import { useContainer } from '../context/AppContext'

const ORG_NAME = (import.meta.env.VITE_ORG_NAME as string | undefined) ?? 'Heritage Christian Academy'

export function GivingWallPage() {
  const { givingWallId } = useContainer()
  const [searchParams] = useSearchParams()
  const [modalOpen, setModalOpen] = useState(false)

  // Set by the Stripe Checkout success_url / cancel_url. The brick itself
  // arrives via realtime once the webhook records the donation.
  const checkoutResult = searchParams.get('checkout')

  const wallTitle     = useThemeText('wall_title',           'Giving Wall')
  const bannerHeading = useThemeText('text_banner_heading',  'Place your brick on the wall')
  const bannerBody    = useThemeText('text_banner_body',     'Support HCA with a gift and add your name to the foundation.')
  const wallCta       = useThemeText('text_wall_cta',        'Click the next open brick to give!')
  const modalTitle    = useThemeText('text_modal_title',     'Make a gift')

  return (
    <div className="min-h-screen flex flex-col bg-stone-100 font-body">
      <MockBanner />

      <WallHeader
        title={wallTitle}
        orgName={ORG_NAME}
        logoMark={<LogoMark fallbackIcon={<Heart className="w-8 h-8 text-white" />} />}
      />

      <WallBanner heading={bannerHeading} body={bannerBody} />

      {checkoutResult === 'success' && (
        <p className="px-6 py-2.5 text-sm text-center bg-emerald-900/30 border-b border-emerald-700/50 text-emerald-300">
          Thank you — your gift was received. Your brick appears on the wall as soon as the payment is confirmed.
        </p>
      )}
      {checkoutResult === 'cancelled' && (
        <p className="px-6 py-2.5 text-sm text-center bg-stone-800/60 border-b border-stone-600/50 text-stone-300">
          Checkout was cancelled — no payment was taken.
        </p>
      )}

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
        <GivingWallGrid givingWallId={givingWallId} onCtaClick={() => setModalOpen(true)} />
      </section>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={modalTitle}
      >
        <DonationCheckout givingWallId={givingWallId} />
      </Modal>
    </div>
  )
}
