import { useState } from 'react'
import { PrayerWallGrid } from '../components/PrayerWallGrid'
import { MockBanner } from '../components/MockBanner'
import { BookOpen } from 'lucide-react'
import { Modal } from '../components/ui/Modal'
import { CommitmentForm } from '../components/CommitmentForm'
import { usePrayerCategories } from '../hooks/usePrayerCategories'

const WALL_ID = import.meta.env.VITE_WALL_ID as string
const ORG_ID = import.meta.env.VITE_ORG_ID as string
const ORG_NAME = (import.meta.env.VITE_ORG_NAME as string | undefined) ?? 'Heritage Christian Academy'

function LogoMark() {
  return (
    <div className="w-[60px] h-[60px] rounded-full bg-[#5e061e] flex items-center justify-center shrink-0">
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

  return (
    <div className="min-h-screen flex flex-col bg-stone-100 font-body">
      <MockBanner />

      <header className="flex items-center gap-4 px-8 py-6 bg-white border-b border-stone-200">
        <LogoMark />
        <div className="flex-1">
          <h1 className="font-sans text-[26px] font-semibold text-[#242148] leading-tight tracking-tight">Prayer Foundation</h1>
          <p className="text-sm text-[#88838a] mt-0.5">{ORG_NAME}</p>
        </div>
      </header>

      <section className="px-8 py-5 bg-white border-b border-stone-200">
        <h2 className="text-[15px] font-semibold text-[#342f31] mb-1">Add your name to the wall</h2>
        <p className="text-[13px] text-[#88838a] leading-relaxed mb-3">
          Commit to pray for one or more areas and place your stone on the foundation.
        </p>
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <span
                key={cat.id}
                className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-[#f4f0f4] text-[#242148] border border-[#d9d9d9]"
              >
                {cat.name}
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="flex-1 px-0 pb-10 bg-[#d7c39d] overflow-x-clip">
        <div className="flex items-center gap-2 text-[14px] font-semibold text-[#342f31] pt-4 pb-3 px-6">
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
