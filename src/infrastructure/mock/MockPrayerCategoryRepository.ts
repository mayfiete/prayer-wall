import type { IPrayerCategoryRepository } from '../../domain/repositories/IPrayerCategoryRepository'
import type { PrayerCategory } from '../../domain/entities/PrayerCategory'
import { MOCK_CATEGORIES } from './mockData'

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export class MockPrayerCategoryRepository implements IPrayerCategoryRepository {
  async findActiveByChurch(churchId: string): Promise<PrayerCategory[]> {
    await delay(200)
    return MOCK_CATEGORIES.filter((c) => c.churchId === churchId && c.isActive)
  }
}
