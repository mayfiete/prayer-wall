import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Modal } from '../components/ui/Modal'
import { CommitmentForm } from '../components/CommitmentForm'
import { MockBanner } from '../components/MockBanner'
import { usePrayerCategories } from '../hooks/usePrayerCategories'
import { PrayerWallGrid } from '../components/PrayerWallGrid'
import { ArrowLeft } from 'lucide-react'

const WALL_ID = import.meta.env.VITE_WALL_ID as string
const ORG_ID = import.meta.env.VITE_ORG_ID as string
const ORG_NAME = (import.meta.env.VITE_ORG_NAME as string | undefined) ?? 'My Organization'

export function CommitmentPage() {
  const navigate = useNavigate()
  const [modalOpen, setModalOpen] = useState(false)
  const { categories } = usePrayerCategories(ORG_ID)

  const handleSuccess = () => {
    setModalOpen(false)
    setTimeout(() => void navigate('/'), 400)
  }

  return (
    <div className="min-h-screen flex flex-col bg-stone-100 font-body">
      <MockBanner />

      <header className="flex items-center gap-3 px-4 py-4 sm:px-8 sm:py-5 bg-white border-b border-stone-200">
        <Link to="/" className="flex h-11 w-11 shrink-0 items-center justify-center text-[var(--color-muted)] hover:text-[var(--color-heading)] transition-colors" aria-label="Back to Prayer Wall">
          <ArrowLeft size={20} />
        </Link>
        <div className="min-w-0 flex-1 break-words">
          <h1 className="font-sans text-[22px] font-semibold text-[var(--color-heading)] leading-tight">
            Add your stone
          </h1>
          <p className="text-[13px] text-[var(--color-muted)] mt-0.5">
            {ORG_NAME} — click the next open stone to place your name
          </p>
        </div>
      </header>

      <main className="flex-1 py-4 sm:py-6 bg-white">
        <div className="px-4 pb-4 sm:px-8">
          <button type="button" className="wall-action" onClick={() => setModalOpen(true)}>Commit to pray</button>
        </div>
        <PrayerWallGrid wallId={WALL_ID} onCtaClick={() => setModalOpen(true)} />
      </main>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Commit to pray"
      >
        <CommitmentForm
          wallId={WALL_ID}
          orgId={ORG_ID}
          categories={categories}
          onSuccess={handleSuccess}
        />
      </Modal>
    </div>
  )
}
