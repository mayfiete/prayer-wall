// src/infrastructure/mock/MockPrayerCategoryRepository.ts
import type {
  IPrayerCategoryRepository,
  CreateCategoryData,
  UpdateCategoryData,
} from '../../domain/repositories/IPrayerCategoryRepository'
import type { PrayerCategory } from '../../domain/entities/PrayerCategory'
import { MOCK_CATEGORIES } from './mockData'
import { NotFoundError } from '../../domain/errors/DomainError'

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export class MockPrayerCategoryRepository implements IPrayerCategoryRepository {
  private categories: PrayerCategory[] = [...MOCK_CATEGORIES]
  private nextId = 100

  async findActiveByOrg(orgId: string): Promise<PrayerCategory[]> {
    await delay(200)
    return this.categories
      .filter((c) => c.orgId === orgId && c.isActive)
      .sort((a, b) => a.displayOrder - b.displayOrder)
  }

  async findAllByOrg(orgId: string): Promise<PrayerCategory[]> {
    await delay(200)
    return this.categories
      .filter((c) => c.orgId === orgId)
      .sort((a, b) => a.displayOrder - b.displayOrder)
  }

  async create(data: CreateCategoryData): Promise<PrayerCategory> {
    await delay(300)
    const cat: PrayerCategory = {
      id: `mock-cat-${++this.nextId}`,
      orgId: data.orgId,
      name: data.name.trim(),
      displayOrder: data.displayOrder,
      isActive: true,
    }
    this.categories.push(cat)
    return cat
  }

  async update(id: string, data: UpdateCategoryData): Promise<PrayerCategory> {
    await delay(300)
    const idx = this.categories.findIndex((c) => c.id === id)
    if (idx === -1) throw new NotFoundError('Category')
    if (data.name !== undefined || data.displayOrder !== undefined) {
      this.categories[idx] = {
        ...this.categories[idx],
        ...(data.name !== undefined && { name: data.name.trim() }),
        ...(data.displayOrder !== undefined && { displayOrder: data.displayOrder }),
      }
    }
    return this.categories[idx]
  }

  async setActive(id: string, active: boolean): Promise<void> {
    await delay(200)
    const cat = this.categories.find((c) => c.id === id)
    if (!cat) throw new NotFoundError('Category')
    cat.isActive = active
  }

  async delete(id: string): Promise<void> {
    await delay(200)
    const before = this.categories.length
    this.categories = this.categories.filter((c) => c.id !== id)
    if (this.categories.length === before) throw new NotFoundError('Category')
  }
}
