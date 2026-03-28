import type { PrayerCategory } from '../entities/PrayerCategory'

export interface IPrayerCategoryRepository {
  findActiveByChurch(churchId: string): Promise<PrayerCategory[]>
}
