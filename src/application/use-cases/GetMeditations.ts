import type { IPrayerMeditationRepository } from '../../domain/repositories/IPrayerMeditationRepository'
import type { PrayerMeditation } from '../../domain/entities/PrayerMeditation'

export class GetMeditations {
  constructor(private readonly meditationRepo: IPrayerMeditationRepository) {}

  async execute(categoryId: string): Promise<PrayerMeditation[]> {
    return this.meditationRepo.findByCategory(categoryId)
  }
}
