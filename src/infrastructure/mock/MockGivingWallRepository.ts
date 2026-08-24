import type { IGivingWallRepository } from '../../domain/repositories/IGivingWallRepository'
import type { Donation, CreateDonationData } from '../../domain/entities/Donation'

const MOCK_DONATIONS: Donation[] = [
  { id: 'mock-1', givingWallId: 'mock-wall', name: 'Sarah Johnson', donatedAt: new Date('2024-01-15'), amountCents: 5000, currency: 'usd', processorRef: null, emailOptOut: false },
  { id: 'mock-2', givingWallId: 'mock-wall', name: 'Michael Chen', donatedAt: new Date('2024-01-16'), amountCents: 10000, currency: 'usd', processorRef: null, emailOptOut: false },
  { id: 'mock-3', givingWallId: 'mock-wall', name: 'The Williams Family', donatedAt: new Date('2024-01-17'), amountCents: 25000, currency: 'usd', processorRef: null, emailOptOut: false },
  { id: 'mock-4', givingWallId: 'mock-wall', name: 'Anonymous', donatedAt: new Date('2024-01-18'), amountCents: 1000, currency: 'usd', processorRef: null, emailOptOut: true },
  { id: 'mock-5', givingWallId: 'mock-wall', name: 'Robert & Lisa Davis', donatedAt: new Date('2024-01-19'), amountCents: 50000, currency: 'usd', processorRef: null, emailOptOut: false },
]

export class MockGivingWallRepository implements IGivingWallRepository {
  private donations: Donation[] = [...MOCK_DONATIONS]

  async findAllByWall(givingWallId: string): Promise<Donation[]> {
    return this.donations.filter(d => d.givingWallId === givingWallId || givingWallId === 'mock-wall')
  }

  async findById(id: string): Promise<Donation | null> {
    return this.donations.find(d => d.id === id) ?? null
  }

  async create(data: CreateDonationData): Promise<Donation> {
    const donation: Donation = {
      id: `mock-${Date.now()}`,
      givingWallId: data.givingWallId,
      name: data.name,
      donatedAt: new Date(),
      amountCents: data.amountCents,
      currency: data.currency ?? 'usd',
      processorRef: data.processorRef ?? null,
      emailOptOut: false,
    }
    this.donations.unshift(donation)
    return donation
  }

  async setEmailOptOut(id: string, optOut: boolean): Promise<void> {
    const d = this.donations.find(d => d.id === id)
    if (d) d.emailOptOut = optOut
  }
}
