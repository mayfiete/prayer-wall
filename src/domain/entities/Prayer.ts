export interface Prayer {
  id: string
  wallId: string
  name: string
  committedAt: Date
  reminderActive: boolean
  lastRemindedAt: Date | null
}

export interface PrayerWithCategories extends Prayer {
  categoryIds: string[]
}

export interface CreatePrayerData {
  wallId: string
  name: string
  email: string
  categoryIds: string[]
}
