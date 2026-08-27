import { useState } from 'react'
import { PrayerWallGrid } from '../components/PrayerWallGrid'
import { MockBanner } from '../components/MockBanner'
import { BookOpen } from 'lucide-react'
import { Modal } from '../components/ui/Modal'
import { CommitmentForm } from '../components/CommitmentForm'
import { LogoMark } from '../components/LogoMark'
import { PrayerHandsIcon } from '../components/PrayerHandsIcon'
import { WallHeader } from '../components/WallHeader'
import { WallBanner } from '../components/WallBanner'
import { usePrayerCategories } from '../hooks/usePrayerCategories'
import { useThemeText } from '../hooks/useThemeText'

const WALL_ID = import.meta.env.VITE_WALL_ID as string
const ORG_ID = import.meta.env.VITE_ORG_ID as string
const ORG_NAME = (import.meta.env.VITE_ORG_NAME as string | undefined) ?? 'Heritage Christian Academy'


export function WallPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const { categories } = usePrayerCategories(ORG_ID)
  const wallTitle       = useThemeText('wall_title',           'Prayer Foundation')
  const bannerHeading   = useThemeText('text_banner_heading',  'Add your name to the wall')
  const bannerBody      = useThemeText('text_banner_body',     'Commit to pray for one or more areas of need and place your stone on the foundation.')
  const wallCta         = useThemeText('text_wall_cta',        'Click the next open stone to join!')
  const modalTitle      = useThemeText('text_modal_title',     'Commit to pray')
  const successHeading  = useThemeText('text_success_heading', 'Your stone has been placed!')
  const successBody     = useThemeText('text_success_body',    'You will receive weekly prayer reminders by email.')
  const submitButton    = useThemeText('text_submit_button',   'Add my stone to the foundation!')

  const categoryPills = categories.length > 0 ? (
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
  ) : undefined

  return (
    <div className="min-h-screen flex flex-col bg-stone-100 font-body">
      <MockBanner />

      <WallHeader
        title={wallTitle}
        orgName={ORG_NAME}
        logoMark={<LogoMark fallbackIcon={<PrayerHandsIcon className="prayer-hands-icon" />} />}
      />

      <WallBanner heading={bannerHeading} body={bannerBody} footer={categoryPills} />

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
