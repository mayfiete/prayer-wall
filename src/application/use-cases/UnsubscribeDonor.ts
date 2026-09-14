import type { IGivingWallRepository } from '../../domain/repositories/IGivingWallRepository'
import { ValidationError } from '../../domain/errors/DomainError'

export class UnsubscribeDonor {
  constructor(private readonly givingWallRepo: IGivingWallRepository) {}

  async execute(donationId: string): Promise<void> {
    if (!donationId.trim()) {
      throw new ValidationError('Donation id is required')
    }
    await this.givingWallRepo.setEmailOptOut(donationId, true)
  }
}
