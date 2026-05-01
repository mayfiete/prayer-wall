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

let categories: PrayerCategory[] = [...MOCK_CATEGORIES]
let nextId = 100

export class MockPrayerCategoryRepository implements IPrayerCategoryRepository {
  async findActiveByOrg(orgId: string): Promise<PrayerCategory[]> {
    await delay(200)
    return categories
      .filter((c) => c.orgId === orgId && c.isActive)
      .sort((a, b) => a.displayOrder - b.displayOrder)
  }

  async findAllByOrg(orgId: string): Promise<PrayerCategory[]> {
    await delay(200)
    return categories
      .filter((c) => c.orgId === orgId)
      .sort((a, b) => a.displayOrder - b.displayOrder)
  }

  async create(data: CreateCategoryData): Promise<PrayerCategory> {
    await delay(300)
    const cat: PrayerCategory = {
      id: `mock-cat-${++nextId}`,
      orgId: data.orgId,
      name: data.name.trim(),
      displayOrder: data.displayOrder,
      isActive: true,
    }
    categories.push(cat)
    return cat
  }

  async update(id: string, data: UpdateCategoryData): Promise<PrayerCategory> {
    await delay(300)
    const idx = categories.findIndex((c) => c.id === id)
    if (idx === -1) throw new NotFoundError('Category')
    categories[idx] = {
      ...categories[idx],
      ...(data.name !== undefined && { name: data.name.trim() }),
      ...(data.displayOrder !== undefined && { displayOrder: data.displayOrder }),
    }
    return categories[idx]
  }

  async setActive(id: string, active: boolean): Promise<void> {
    await delay(200)
    const cat = categories.find((c) => c.id === id)
    if (!cat) throw new NotFoundError('Category')
    cat.isActive = active
  }

  async delete(id: string): Promise<void> {
    await delay(200)
    const before = categories.length
    categories = categories.filter((c) => c.id !== id)
    if (categories.length === before) throw new NotFoundError('Category')
  }
}
