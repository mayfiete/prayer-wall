import type { IPrayerRepository } from '../domain/repositories/IPrayerRepository'
import type { IPrayerCategoryRepository } from '../domain/repositories/IPrayerCategoryRepository'
import type { IPrayerMeditationRepository } from '../domain/repositories/IPrayerMeditationRepository'
import type { IGivingWallRepository } from '../domain/repositories/IGivingWallRepository'
import type { IPaymentGateway } from '../domain/gateways/IPaymentGateway'
import { isSimulatedGateway } from '../domain/gateways/IPaymentGateway'
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
import { GetGivingWall } from '../application/use-cases/GetGivingWall'
import { StartDonationCheckout } from '../application/use-cases/StartDonationCheckout'
import { ConfirmSimulatedDonation } from '../application/use-cases/ConfirmSimulatedDonation'
import { UnsubscribeDonor } from '../application/use-cases/UnsubscribeDonor'

import { MockPrayerRepository } from './mock/MockPrayerRepository'
import { MockPrayerCategoryRepository } from './mock/MockPrayerCategoryRepository'
import { MockPrayerMeditationRepository } from './mock/MockPrayerMeditationRepository'
import { MockGivingWallRepository } from './mock/MockGivingWallRepository'
import { MockPaymentGateway } from './mock/MockPaymentGateway'
import { MockRealtimeClient } from './mock/MockRealtimeClient'
import { MOCK_GIVING_WALL_ID } from './mock/mockData'

import { createSupabaseClient } from './supabase/client'
import { SupabasePrayerRepository } from './repositories/SupabasePrayerRepository'
import { SupabasePrayerCategoryRepository } from './repositories/SupabasePrayerCategoryRepository'
import { SupabasePrayerMeditationRepository } from './repositories/SupabasePrayerMeditationRepository'
import { SupabaseGivingWallRepository } from './repositories/SupabaseGivingWallRepository'
import { StripeCheckoutGateway } from './gateways/StripeCheckoutGateway'

// DECISION: VITE_USE_MOCK=true → all in-memory mocks (no Supabase needed for local dev).
// VITE_USE_MOCK unset or false → all Supabase repos (production).
// See docs/decisions/003-mock-vs-supabase-repos.md — never use a Mock repo in the else branch.
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

let prayerRepo: IPrayerRepository
let categoryRepo: IPrayerCategoryRepository
let meditationRepo: IPrayerMeditationRepository
let givingWallRepo: IGivingWallRepository
let paymentGateway: IPaymentGateway
let realtimeClient: IRealtimeClient
let givingWallId: string

if (USE_MOCK) {
  prayerRepo = new MockPrayerRepository()
  categoryRepo = new MockPrayerCategoryRepository()
  meditationRepo = new MockPrayerMeditationRepository()
  givingWallRepo = new MockGivingWallRepository()
  const mockRealtime = new MockRealtimeClient()
  // MockPaymentGateway emits the donation INSERT through the realtime client so
  // the brick appears by the same path production uses (webhook → realtime).
  paymentGateway = new MockPaymentGateway(givingWallRepo, mockRealtime)
  realtimeClient = mockRealtime
  givingWallId = MOCK_GIVING_WALL_ID
} else {
  // DECISION: createSupabaseClient() sets db: { schema: 'prayer_wall' }.
  // All repos share one client instance. Admin pages create their own separate client.
  const supabase = createSupabaseClient()
  prayerRepo = new SupabasePrayerRepository(supabase)
  categoryRepo = new SupabasePrayerCategoryRepository(supabase)
  meditationRepo = new SupabasePrayerMeditationRepository(supabase)
  givingWallRepo = new SupabaseGivingWallRepository(supabase)
  paymentGateway = new StripeCheckoutGateway(supabase)
  realtimeClient = supabase
  givingWallId = (import.meta.env.VITE_GIVING_WALL_ID as string | undefined)?.trim() ?? ''
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
  getGivingWall: new GetGivingWall(givingWallRepo),
  unsubscribeDonor: new UnsubscribeDonor(givingWallRepo),
  startDonationCheckout: new StartDonationCheckout(paymentGateway),
  // Non-null only in mock mode — the presentation layer treats a non-null value
  // as "no real processor available, render the simulated card form instead".
  confirmSimulatedDonation: isSimulatedGateway(paymentGateway)
    ? new ConfirmSimulatedDonation(paymentGateway)
    : null,
  givingWallId,
  supabase: realtimeClient,
}
