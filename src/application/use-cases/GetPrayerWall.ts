import type { IPrayerRepository } from '../../domain/repositories/IPrayerRepository'
import type { Prayer } from '../../domain/entities/Prayer'

export class GetPrayerWall {
  constructor(private readonly prayerRepo: IPrayerRepository) {}

  async execute(wallId: string): Promise<Prayer[]> {
    return this.prayerRepo.findAllByWall(wallId)
  }
}
