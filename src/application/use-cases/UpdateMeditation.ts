import type {
  IPrayerMeditationRepository,
  UpdateMeditationData,
} from '../../domain/repositories/IPrayerMeditationRepository'
import type { PrayerMeditation } from '../../domain/entities/PrayerMeditation'
import { ValidationError } from '../../domain/errors/DomainError'

export class UpdateMeditation {
  constructor(private readonly meditationRepo: IPrayerMeditationRepository) {}

  async execute(id: string, data: UpdateMeditationData): Promise<PrayerMeditation> {
    if (data.body !== undefined && !data.body.trim()) {
      throw new ValidationError('Meditation body cannot be empty')
    }
    if (data.displayOrder !== undefined && data.displayOrder < 0) {
      throw new ValidationError('Display order must be 0 or greater')
    }
    return this.meditationRepo.update(id, data)
  }
}
