import type { Prayer, CreatePrayerData } from '../entities/Prayer'

export interface IPrayerRepository {
  findAllByWall(wallId: string): Promise<Prayer[]>
  findById(id: string): Promise<Prayer | null>
  create(data: CreatePrayerData): Promise<Prayer>
  setReminderActive(id: string, active: boolean): Promise<void>
}
