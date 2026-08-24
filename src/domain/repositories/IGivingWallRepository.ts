import type { Donation, CreateDonationData } from '../entities/Donation'

export interface IGivingWallRepository {
  findAllByWall(givingWallId: string): Promise<Donation[]>
  findById(id: string): Promise<Donation | null>
  create(data: CreateDonationData): Promise<Donation>
  setEmailOptOut(id: string, optOut: boolean): Promise<void>
}
