import type { IPrayerMeditationRepository } from '../../domain/repositories/IPrayerMeditationRepository'

export class DeleteMeditation {
  constructor(private readonly meditationRepo: IPrayerMeditationRepository) {}

  async execute(id: string): Promise<void> {
    return this.meditationRepo.delete(id)
  }
}
