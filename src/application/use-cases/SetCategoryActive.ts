import type { IPrayerCategoryRepository } from '../../domain/repositories/IPrayerCategoryRepository'

export class SetCategoryActive {
  constructor(private readonly categoryRepo: IPrayerCategoryRepository) {}

  async execute(id: string, active: boolean): Promise<void> {
    return this.categoryRepo.setActive(id, active)
  }
}
