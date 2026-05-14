import type { IPrayerCategoryRepository } from '../../domain/repositories/IPrayerCategoryRepository'
import type { PrayerCategory } from '../../domain/entities/PrayerCategory'

export class GetPrayerCategories {
  constructor(private readonly categoryRepo: IPrayerCategoryRepository) {}

  async execute(orgId: string): Promise<PrayerCategory[]> {
    return this.categoryRepo.findActiveByOrg(orgId)
  }
}
