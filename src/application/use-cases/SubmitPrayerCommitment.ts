import type { IPrayerRepository } from '../../domain/repositories/IPrayerRepository'
import type { IPrayerCategoryRepository } from '../../domain/repositories/IPrayerCategoryRepository'
import type { Prayer } from '../../domain/entities/Prayer'
import type { SubmitPrayerCommitmentDto } from '../dto/SubmitPrayerCommitmentDto'
import { ValidationError } from '../../domain/errors/DomainError'

const MAX_CATEGORIES = 3

export class SubmitPrayerCommitment {
  constructor(
    private readonly prayerRepo: IPrayerRepository,
    private readonly categoryRepo: IPrayerCategoryRepository,
  ) {}

  async execute(dto: SubmitPrayerCommitmentDto): Promise<Prayer> {
    if (!dto.name.trim()) {
      throw new ValidationError('Name is required')
    }
    if (!dto.email.trim() || !dto.email.includes('@')) {
      throw new ValidationError('A valid email address is required')
    }
    if (dto.categoryIds.length === 0) {
      throw new ValidationError('At least one prayer category must be selected')
    }
    if (dto.categoryIds.length > MAX_CATEGORIES) {
      throw new ValidationError(`No more than ${MAX_CATEGORIES} categories may be selected`)
    }

    const available = await this.categoryRepo.findActiveByChurch(dto.churchId)
    const availableIds = new Set(available.map((c) => c.id))
    const invalid = dto.categoryIds.filter((id) => !availableIds.has(id))
    if (invalid.length > 0) {
      throw new ValidationError('One or more selected categories are invalid')
    }

    return this.prayerRepo.create({
      churchId: dto.churchId,
      name: dto.name.trim(),
      email: dto.email.trim().toLowerCase(),
      categoryIds: dto.categoryIds,
    })
  }
}
