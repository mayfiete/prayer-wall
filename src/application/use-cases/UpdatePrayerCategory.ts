import type {
  IPrayerCategoryRepository,
  UpdateCategoryData,
} from '../../domain/repositories/IPrayerCategoryRepository'
import type { PrayerCategory } from '../../domain/entities/PrayerCategory'
import { ValidationError } from '../../domain/errors/DomainError'

export class UpdatePrayerCategory {
  constructor(private readonly categoryRepo: IPrayerCategoryRepository) {}

  async execute(id: string, data: UpdateCategoryData): Promise<PrayerCategory> {
    if (data.name !== undefined && !data.name.trim()) {
      throw new ValidationError('Category name cannot be empty')
    }
    if (data.displayOrder !== undefined && data.displayOrder < 0) {
      throw new ValidationError('Display order must be 0 or greater')
    }
    return this.categoryRepo.update(id, data)
  }
}
