import { useRef, useCallback, useMemo } from 'react'
import { Heart } from 'lucide-react'
import { WallBrick, WallCtaBrick } from './WallBrick'
import { WallGrid, type WallGridItem } from './WallGrid'
import { useGivingWall } from '../hooks/useGivingWall'
import { useRealtimeDonations } from '../hooks/useRealtimeDonations'
import type { Donation } from '../../domain/entities/Donation'

interface GivingWallGridProps {
  givingWallId: string
  onCtaClick?: () => void
}

export function GivingWallGrid({ givingWallId, onCtaClick }: GivingWallGridProps) {
  const { donations, loading, error, addDonation } = useGivingWall(givingWallId)
  const newIdsRef = useRef<Set<string>>(new Set())

  const handleNewDonation = useCallback(
    (donation: Donation) => {
      newIdsRef.current.add(donation.id)
      addDonation(donation)
    },
    [addDonation],
  )

  useRealtimeDonations(givingWallId, handleNewDonation)

  const items = useMemo<WallGridItem[]>(
    () =>
      donations.map((d) => ({
        key: d.id,
        node: <WallBrick name={d.name} isNew={newIdsRef.current.has(d.id)} />,
      })),
    [donations],
  )

  const ctaBrick = useMemo(
    () => (
      <WallCtaBrick
        icon={<Heart className="w-6 h-6 text-white opacity-80" />}
        ariaLabel="Place your brick on the giving wall"
        onClick={onCtaClick}
      />
    ),
    [onCtaClick],
  )

  return <WallGrid items={items} ctaBrick={ctaBrick} loading={loading} error={error} />
}
