import type { IPrayerRepository } from '../domain/repositories/IPrayerRepository'
import type { IPrayerCategoryRepository } from '../domain/repositories/IPrayerCategoryRepository'
import type { IRealtimeClient } from './mock/MockRealtimeClient'

import { GetPrayerWall } from '../application/use-cases/GetPrayerWall'
import { GetPrayerCategories } from '../application/use-cases/GetPrayerCategories'
import { SubmitPrayerCommitment } from '../application/use-cases/SubmitPrayerCommitment'
import { UnsubscribeFromReminders } from '../application/use-cases/UnsubscribeFromReminders'

import { MockPrayerRepository } from './mock/MockPrayerRepository'
import { MockPrayerCategoryRepository } from './mock/MockPrayerCategoryRepository'
import { MockRealtimeClient } from './mock/MockRealtimeClient'

import { createSupabaseClient } from './supabase/client'
import { SupabasePrayerRepository } from './repositories/SupabasePrayerRepository'
import { SupabasePrayerCategoryRepository } from './repositories/SupabasePrayerCategoryRepository'

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

let prayerRepo: IPrayerRepository
let categoryRepo: IPrayerCategoryRepository
let realtimeClient: IRealtimeClient

if (USE_MOCK) {
  prayerRepo = new MockPrayerRepository()
  categoryRepo = new MockPrayerCategoryRepository()
  realtimeClient = new MockRealtimeClient()
} else {
  const supabase = createSupabaseClient()
  prayerRepo = new SupabasePrayerRepository(supabase)
  categoryRepo = new SupabasePrayerCategoryRepository(supabase)
  realtimeClient = supabase as unknown as IRealtimeClient
}

export const container = {
  getPrayerWall: new GetPrayerWall(prayerRepo),
  getPrayerCategories: new GetPrayerCategories(categoryRepo),
  submitPrayerCommitment: new SubmitPrayerCommitment(prayerRepo, categoryRepo),
  unsubscribeFromReminders: new UnsubscribeFromReminders(prayerRepo),
  supabase: realtimeClient,
}
