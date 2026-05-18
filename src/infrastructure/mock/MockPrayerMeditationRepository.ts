import type {
  IPrayerMeditationRepository,
  CreateMeditationData,
  UpdateMeditationData,
} from '../../domain/repositories/IPrayerMeditationRepository'
import type { PrayerMeditation } from '../../domain/entities/PrayerMeditation'
import { MOCK_MEDITATIONS } from './mockData'
import { NotFoundError } from '../../domain/errors/DomainError'

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

export class MockPrayerMeditationRepository implements IPrayerMeditationRepository {
  private statements: PrayerMeditation[] = [...MOCK_MEDITATIONS]
  private nextId = 200

  async findByCategory(categoryId: string): Promise<PrayerMeditation[]> {
    await delay(150)
    return this.statements
      .filter((s) => s.categoryId === categoryId)
      .sort((a, b) => a.displayOrder - b.displayOrder)
  }

  async findActiveByCategory(categoryId: string): Promise<PrayerMeditation[]> {
    await delay(150)
    return this.statements
      .filter((s) => s.categoryId === categoryId && s.isActive)
      .sort((a, b) => a.displayOrder - b.displayOrder)
  }

  async create(data: CreateMeditationData): Promise<PrayerMeditation> {
    await delay(250)
    const stmt: PrayerMeditation = {
      id: `mock-med-${++this.nextId}`,
      categoryId: data.categoryId,
      orgId: data.orgId,
      body: data.body.trim(),
      displayOrder: data.displayOrder,
      isActive: true,
      createdAt: new Date(),
    }
    this.statements.push(stmt)
    return stmt
  }

  async update(id: string, data: UpdateMeditationData): Promise<PrayerMeditation> {
    await delay(250)
    const idx = this.statements.findIndex((s) => s.id === id)
    if (idx === -1) throw new NotFoundError('Meditation')
    this.statements[idx] = {
      ...this.statements[idx],
      ...(data.body !== undefined && { body: data.body.trim() }),
      ...(data.displayOrder !== undefined && { displayOrder: data.displayOrder }),
    }
    return this.statements[idx]
  }

  async setActive(id: string, active: boolean): Promise<void> {
    await delay(150)
    const stmt = this.statements.find((s) => s.id === id)
    if (!stmt) throw new NotFoundError('Meditation')
    stmt.isActive = active
  }

  async delete(id: string): Promise<void> {
    await delay(150)
    const before = this.statements.length
    this.statements = this.statements.filter((s) => s.id !== id)
    if (this.statements.length === before) throw new NotFoundError('Meditation')
  }
}
