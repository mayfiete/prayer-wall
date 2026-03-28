import type { IPrayerRepository } from '../../domain/repositories/IPrayerRepository'
import { NotFoundError } from '../../domain/errors/DomainError'

export class UnsubscribeFromReminders {
  constructor(private readonly prayerRepo: IPrayerRepository) {}

  async execute(commitmentId: string): Promise<void> {
    const prayer = await this.prayerRepo.findById(commitmentId)
    if (!prayer) {
      throw new NotFoundError('Prayer commitment')
    }
    await this.prayerRepo.setReminderActive(commitmentId, false)
  }
}
