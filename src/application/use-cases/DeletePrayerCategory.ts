import type { IPrayerCategoryRepository } from '../../domain/repositories/IPrayerCategoryRepository'

export class DeletePrayerCategory {
  constructor(private readonly categoryRepo: IPrayerCategoryRepository) {}

  async execute(id: string): Promise<void> {
    return this.categoryRepo.delete(id)
  }
}
