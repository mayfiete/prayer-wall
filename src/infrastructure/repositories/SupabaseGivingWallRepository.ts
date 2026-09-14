import type { IGivingWallRepository } from '../../domain/repositories/IGivingWallRepository'
import type { Donation, CreateDonationData } from '../../domain/entities/Donation'
import type { Database } from '../supabase/types'
import { createSupabaseClient } from '../supabase/client'

type SupabaseClientType = ReturnType<typeof createSupabaseClient>

// `email` is deliberately absent: migration 024 revokes SELECT on that column
// from anon and authenticated, so asking for it fails with permission denied.
const DONATION_COLUMNS =
  'id, giving_wall_id, name, amount_cents, currency, processor, processor_ref, email_opt_out, donated_at, created_at' as const

type DonationRow = Pick<
  Database['prayer_wall']['Tables']['donations']['Row'],
  'id' | 'giving_wall_id' | 'name' | 'amount_cents' | 'currency' | 'processor_ref' | 'email_opt_out' | 'donated_at'
>

function rowToDomain(row: DonationRow): Donation {
  return {
    id: row.id,
    givingWallId: row.giving_wall_id,
    name: row.name,
    donatedAt: new Date(row.donated_at),
    amountCents: row.amount_cents,
    currency: row.currency,
    processorRef: row.processor_ref,
    emailOptOut: row.email_opt_out,
  }
}

export class SupabaseGivingWallRepository implements IGivingWallRepository {
  constructor(private readonly supabase: SupabaseClientType) {}

  async findAllByWall(givingWallId: string): Promise<Donation[]> {
    const { data, error } = await this.supabase
      .from('donations')
      .select(DONATION_COLUMNS)
      .eq('giving_wall_id', givingWallId)
      .order('donated_at', { ascending: false })

    if (error) throw new Error(error.message)
    return (data ?? []).map(rowToDomain)
  }

  async findById(id: string): Promise<Donation | null> {
    const { data, error } = await this.supabase
      .from('donations')
      .select(DONATION_COLUMNS)
      .eq('id', id)
      .maybeSingle()

    if (error) throw new Error(error.message)
    return data ? rowToDomain(data) : null
  }

  /**
   * Only the giving-wall-webhook edge function (service_role) may create
   * donations — RLS rejects this call from the browser by design. It exists so
   * the interface stays honest and the mock can implement the same contract.
   */
  async create(data: CreateDonationData): Promise<Donation> {
    const { data: row, error } = await this.supabase
      .from('donations')
      .insert({
        giving_wall_id: data.givingWallId,
        name: data.name,
        amount_cents: data.amountCents,
        currency: data.currency ?? 'usd',
        processor_ref: data.processorRef ?? null,
      })
      .select(DONATION_COLUMNS)
      .single()

    if (error) throw new Error(error.message)
    return rowToDomain(row)
  }

  async setEmailOptOut(id: string, optOut: boolean): Promise<void> {
    if (!optOut) {
      // Re-subscribing is an admin action, not a public one — no endpoint for it.
      throw new Error('Donors can only be opted out, not opted back in')
    }

    // RLS grants UPDATE on donations to service_role only, so this has to go
    // through the unsubscribe edge function rather than a direct table update.
    const { error } = await this.supabase.functions.invoke('unsubscribe', {
      body: { donation_id: id },
    })

    if (error) throw new Error(error.message)
  }
}
