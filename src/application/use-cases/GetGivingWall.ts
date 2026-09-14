import type { IGivingWallRepository } from '../../domain/repositories/IGivingWallRepository'
import type { Donation } from '../../domain/entities/Donation'

export class GetGivingWall {
  constructor(private readonly givingWallRepo: IGivingWallRepository) {}

  async execute(givingWallId: string): Promise<Donation[]> {
    return this.givingWallRepo.findAllByWall(givingWallId)
  }
}
