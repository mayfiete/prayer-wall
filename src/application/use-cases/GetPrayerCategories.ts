import type { IPrayerCategoryRepository } from '../../domain/repositories/IPrayerCategoryRepository'
import type { PrayerCategory } from '../../domain/entities/PrayerCategory'

export class GetPrayerCategories {
  constructor(private readonly categoryRepo: IPrayerCategoryRepository) {}

  async execute(churchId: string): Promise<PrayerCategory[]> {
    return this.categoryRepo.findActiveByChurch(churchId)
  }
}
