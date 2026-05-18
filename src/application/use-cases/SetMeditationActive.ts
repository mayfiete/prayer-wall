import type { IPrayerMeditationRepository } from '../../domain/repositories/IPrayerMeditationRepository'

export class SetMeditationActive {
  constructor(private readonly meditationRepo: IPrayerMeditationRepository) {}

  async execute(id: string, active: boolean): Promise<void> {
    return this.meditationRepo.setActive(id, active)
  }
}
