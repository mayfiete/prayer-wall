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

      <header className="flex items-center gap-4 px-8 py-5 bg-white border-b border-stone-200">
        <Link to="/" className="text-[var(--color-muted)] hover:text-[var(--color-heading)] transition-colors" aria-label="Back to Prayer Wall">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <h1 className="font-sans text-[22px] font-semibold text-[var(--color-heading)] leading-tight">
            Add your stone
          </h1>
          <p className="text-[13px] text-[var(--color-muted)] mt-0.5">
            {ORG_NAME} — click the next open stone to place your name
          </p>
        </div>
      </header>

      <main className="flex-1 px-6 py-6 bg-white">
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
