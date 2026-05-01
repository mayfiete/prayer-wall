import type {
  IPrayerCategoryRepository,
  CreateCategoryData,
} from '../../domain/repositories/IPrayerCategoryRepository'
import type { PrayerCategory } from '../../domain/entities/PrayerCategory'
import { ValidationError } from '../../domain/errors/DomainError'

export class CreatePrayerCategory {
  constructor(private readonly categoryRepo: IPrayerCategoryRepository) {}

  async execute(data: CreateCategoryData): Promise<PrayerCategory> {
    if (!data.name.trim()) throw new ValidationError('Category name is required')
    if (data.displayOrder < 0) throw new ValidationError('Display order must be 0 or greater')
    return this.categoryRepo.create(data)
  }
}
