import type { IPrayerRepository } from '../domain/repositories/IPrayerRepository'
import type { IPrayerCategoryRepository } from '../domain/repositories/IPrayerCategoryRepository'
import type { IPrayerMeditationRepository } from '../domain/repositories/IPrayerMeditationRepository'
import type { IRealtimeClient } from './mock/MockRealtimeClient'

import { GetPrayerWall } from '../application/use-cases/GetPrayerWall'
import { GetPrayerCategories } from '../application/use-cases/GetPrayerCategories'
import { GetAllPrayerCategories } from '../application/use-cases/GetAllPrayerCategories'
import { SubmitPrayerCommitment } from '../application/use-cases/SubmitPrayerCommitment'
import { UnsubscribeFromReminders } from '../application/use-cases/UnsubscribeFromReminders'
import { CreatePrayerCategory } from '../application/use-cases/CreatePrayerCategory'
import { UpdatePrayerCategory } from '../application/use-cases/UpdatePrayerCategory'
import { SetCategoryActive } from '../application/use-cases/SetCategoryActive'
import { DeletePrayerCategory } from '../application/use-cases/DeletePrayerCategory'
import { GetMeditations } from '../application/use-cases/GetMeditations'
import { CreateMeditation } from '../application/use-cases/CreateMeditation'
import { UpdateMeditation } from '../application/use-cases/UpdateMeditation'
import { DeleteMeditation } from '../application/use-cases/DeleteMeditation'
import { SetMeditationActive } from '../application/use-cases/SetMeditationActive'

import { MockPrayerRepository } from './mock/MockPrayerRepository'
import { MockPrayerCategoryRepository } from './mock/MockPrayerCategoryRepository'
import { MockPrayerMeditationRepository } from './mock/MockPrayerMeditationRepository'
import { MockRealtimeClient } from './mock/MockRealtimeClient'

import { createSupabaseClient } from './supabase/client'
import { SupabasePrayerRepository } from './repositories/SupabasePrayerRepository'
import { SupabasePrayerCategoryRepository } from './repositories/SupabasePrayerCategoryRepository'

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

let prayerRepo: IPrayerRepository
let categoryRepo: IPrayerCategoryRepository
let meditationRepo: IPrayerMeditationRepository
let realtimeClient: IRealtimeClient

if (USE_MOCK) {
  prayerRepo = new MockPrayerRepository()
  categoryRepo = new MockPrayerCategoryRepository()
  meditationRepo = new MockPrayerMeditationRepository()
  realtimeClient = new MockRealtimeClient()
} else {
  const supabase = createSupabaseClient()
  prayerRepo = new SupabasePrayerRepository(supabase)
  categoryRepo = new SupabasePrayerCategoryRepository(supabase)
  meditationRepo = new MockPrayerMeditationRepository()
  realtimeClient = supabase
}

export const container = {
  getPrayerWall: new GetPrayerWall(prayerRepo),
  getPrayerCategories: new GetPrayerCategories(categoryRepo),
  getAllPrayerCategories: new GetAllPrayerCategories(categoryRepo),
  submitPrayerCommitment: new SubmitPrayerCommitment(prayerRepo, categoryRepo),
  unsubscribeFromReminders: new UnsubscribeFromReminders(prayerRepo),
  createPrayerCategory: new CreatePrayerCategory(categoryRepo),
  updatePrayerCategory: new UpdatePrayerCategory(categoryRepo),
  setCategoryActive: new SetCategoryActive(categoryRepo),
  deletePrayerCategory: new DeletePrayerCategory(categoryRepo),
  getMeditations: new GetMeditations(meditationRepo),
  createMeditation: new CreateMeditation(meditationRepo),
  updateMeditation: new UpdateMeditation(meditationRepo),
  deleteMeditation: new DeleteMeditation(meditationRepo),
  setMeditationActive: new SetMeditationActive(meditationRepo),
  supabase: realtimeClient,
}
