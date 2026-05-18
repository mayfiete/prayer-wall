import type {
  IPrayerMeditationRepository,
  CreateMeditationData,
} from '../../domain/repositories/IPrayerMeditationRepository'
import type { PrayerMeditation } from '../../domain/entities/PrayerMeditation'
import { ValidationError } from '../../domain/errors/DomainError'

export class CreateMeditation {
  constructor(private readonly meditationRepo: IPrayerMeditationRepository) {}

  async execute(data: CreateMeditationData): Promise<PrayerMeditation> {
    if (!data.body.trim()) throw new ValidationError('Meditation body is required')
    if (data.displayOrder < 0) throw new ValidationError('Display order must be 0 or greater')
    return this.meditationRepo.create(data)
  }
}
