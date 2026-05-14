// src/domain/repositories/IPrayerCategoryRepository.ts
import type { PrayerCategory } from '../entities/PrayerCategory'

export interface CreateCategoryData {
  orgId: string
  name: string
  displayOrder: number
}

export interface UpdateCategoryData {
  name?: string
  displayOrder?: number
}

export interface IPrayerCategoryRepository {
  findActiveByOrg(orgId: string): Promise<PrayerCategory[]>
  findAllByOrg(orgId: string): Promise<PrayerCategory[]>
  create(data: CreateCategoryData): Promise<PrayerCategory>
  update(id: string, data: UpdateCategoryData): Promise<PrayerCategory>
  setActive(id: string, active: boolean): Promise<void>
  delete(id: string): Promise<void>
}
