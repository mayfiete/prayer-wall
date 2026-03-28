import { useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Modal } from '../components/ui/Modal'
import { CommitmentForm } from '../components/CommitmentForm'
import { MockBanner } from '../components/MockBanner'
import { usePrayerCategories } from '../hooks/usePrayerCategories'
import { usePrayerWall } from '../hooks/usePrayerWall'
import { useRealtimePrayers } from '../hooks/useRealtimePrayers'
import { PrayerBrick, EmptyBrick } from '../components/PrayerBrick'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { TileModeToggle } from '../components/TileModeToggle'
import type { Prayer } from '../../domain/entities/Prayer'

const CHURCH_ID = import.meta.env.VITE_CHURCH_ID as string
const CHURCH_NAME = (import.meta.env.VITE_CHURCH_NAME as string | undefined) ?? 'Heritage Christian Academy'
const GRID_SIZE = 48

export function CommitmentPage() {
  const navigate = useNavigate()
  const [modalOpen, setModalOpen] = useState(false)
  const { categories, loading: catsLoading } = usePrayerCategories(CHURCH_ID)
  const { prayers, loading: wallLoading, addPrayer } = usePrayerWall(CHURCH_ID)

  const handleNewPrayer = useCallback(
    (prayer: Prayer) => addPrayer(prayer),
    [addPrayer],
  )
  useRealtimePrayers(CHURCH_ID, handleNewPrayer)

  const handleSuccess = () => {
    setModalOpen(false)
    setTimeout(() => void navigate('/'), 400)
  }

  const emptyCount = Math.max(0, GRID_SIZE - prayers.length)
  const isLoading = wallLoading || catsLoading
  const open = () => setModalOpen(true)

  return (
    <div className="min-h-screen flex flex-col bg-parchment-100 font-body">
      <MockBanner />

      <header className="flex items-center gap-4 px-8 py-5 bg-white border-b border-[#e8e0d6]">
        <Link to="/" className="text-[#7a6a5a] hover:text-[#1a1a1a] transition-colors" aria-label="Back to Prayer Wall">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <h1 className="font-serif text-[22px] text-[#1a1a1a] leading-tight">
            Add your stone
          </h1>
          <p className="text-[13px] text-[#888] mt-0.5">
            {CHURCH_NAME} — click any open stone to place your name on the wall
          </p>
        </div>
        <TileModeToggle />
      </header>

      <main className="flex-1 px-8 py-6 bg-white">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-[#6b2737]" size={36} />
          </div>
        ) : (
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-1.5">
            {prayers.map((prayer) => (
              <PrayerBrick key={prayer.id} prayer={prayer} />
            ))}
            {Array.from({ length: emptyCount }).map((_, i) => (
              <EmptyBrick
                key={`open-${i}`}
                onClick={open}
                isPulsing={i === 0}
              />
            ))}
          </div>
        )}
      </main>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Commit to pray"
      >
        <CommitmentForm
          churchId={CHURCH_ID}
          categories={categories}
          onSuccess={handleSuccess}
        />
      </Modal>
    </div>
  )
}
