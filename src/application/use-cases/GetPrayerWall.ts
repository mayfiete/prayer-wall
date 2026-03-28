import type { IPrayerRepository } from '../../domain/repositories/IPrayerRepository'
import type { Prayer } from '../../domain/entities/Prayer'

export class GetPrayerWall {
  constructor(private readonly prayerRepo: IPrayerRepository) {}

  async execute(churchId: string): Promise<Prayer[]> {
    return this.prayerRepo.findAllByChurch(churchId)
  }
}
