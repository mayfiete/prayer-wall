import type { IPrayerRepository } from '../../domain/repositories/IPrayerRepository'
import type { Prayer, CreatePrayerData } from '../../domain/entities/Prayer'
import { NotFoundError } from '../../domain/errors/DomainError'
import { MOCK_PRAYERS, MOCK_CHURCH_ID } from './mockData'

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export class MockPrayerRepository implements IPrayerRepository {
  private prayers: Prayer[] = structuredClone(MOCK_PRAYERS)

  async findAllByChurch(churchId: string): Promise<Prayer[]> {
    await delay(400)
    return this.prayers
      .filter((p) => p.churchId === churchId)
      .sort((a, b) => a.committedAt.getTime() - b.committedAt.getTime())
  }

  async findById(id: string): Promise<Prayer | null> {
    await delay(150)
    return this.prayers.find((p) => p.id === id) ?? null
  }

  async create(data: CreatePrayerData): Promise<Prayer> {
    await delay(600)
    const prayer: Prayer = {
      id: crypto.randomUUID(),
      churchId: data.churchId || MOCK_CHURCH_ID,
      name: data.name,
      committedAt: new Date(),
      reminderActive: true,
      lastRemindedAt: null,
    }
    this.prayers.push(prayer)
    return prayer
  }

  async setReminderActive(id: string, active: boolean): Promise<void> {
    await delay(200)
    const prayer = this.prayers.find((p) => p.id === id)
    if (!prayer) throw new NotFoundError('Prayer commitment')
    prayer.reminderActive = active
  }
}
