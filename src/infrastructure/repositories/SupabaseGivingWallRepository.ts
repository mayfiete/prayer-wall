import type { IGivingWallRepository } from '../../domain/repositories/IGivingWallRepository'
import type { Donation, CreateDonationData } from '../../domain/entities/Donation'
import type { Database } from '../supabase/types'
import { createSupabaseClient } from '../supabase/client'

type SupabaseClientType = ReturnType<typeof createSupabaseClient>

type DonationRow = Database['prayer_wall']['Tables']['donations']['Row']

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
      .select('id, giving_wall_id, name, amount_cents, currency, processor, processor_ref, email, email_opt_out, donated_at, created_at')
      .eq('giving_wall_id', givingWallId)
      .order('donated_at', { ascending: false })

    if (error) throw new Error(error.message)
    return (data ?? []).map(rowToDomain)
  }

  async findById(id: string): Promise<Donation | null> {
    const { data, error } = await this.supabase
      .from('donations')
      .select('id, giving_wall_id, name, amount_cents, currency, processor, processor_ref, email, email_opt_out, donated_at, created_at')
      .eq('id', id)
      .maybeSingle()

    if (error) throw new Error(error.message)
    return data ? rowToDomain(data) : null
  }

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
      .select('id, giving_wall_id, name, amount_cents, currency, processor, processor_ref, email, email_opt_out, donated_at, created_at')
      .single()

    if (error) throw new Error(error.message)
    return rowToDomain(row)
  }

  async setEmailOptOut(id: string, optOut: boolean): Promise<void> {
    const { error } = await this.supabase
      .from('donations')
      .update({ email_opt_out: optOut })
      .eq('id', id)

    if (error) throw new Error(error.message)
  }
}
