export interface Prayer {
  id: string
  churchId: string
  name: string
  committedAt: Date
  reminderActive: boolean
  lastRemindedAt: Date | null
}

export interface PrayerWithCategories extends Prayer {
  categoryIds: string[]
}

export interface CreatePrayerData {
  churchId: string
  name: string
  email: string
  categoryIds: string[]
}
