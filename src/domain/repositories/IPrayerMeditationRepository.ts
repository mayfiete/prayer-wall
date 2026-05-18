import type { PrayerMeditation } from '../entities/PrayerMeditation'

export interface CreateMeditationData {
  categoryId: string
  orgId: string
  body: string
  displayOrder: number
}

export interface UpdateMeditationData {
  body?: string
  displayOrder?: number
}

export interface IPrayerMeditationRepository {
  findByCategory(categoryId: string): Promise<PrayerMeditation[]>
  findActiveByCategory(categoryId: string): Promise<PrayerMeditation[]>
  create(data: CreateMeditationData): Promise<PrayerMeditation>
  update(id: string, data: UpdateMeditationData): Promise<PrayerMeditation>
  setActive(id: string, active: boolean): Promise<void>
  delete(id: string): Promise<void>
}
