import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../supabase/types'
import type { IPrayerRepository } from '../../domain/repositories/IPrayerRepository'
import type { Prayer, CreatePrayerData } from '../../domain/entities/Prayer'

type DB = Database['prayer_wall']['Tables']
type CommitmentRow = Omit<DB['commitments']['Row'], 'email'>

function rowToPrayer(row: CommitmentRow): Prayer {
  return {
    id: row.id,
    wallId: row.wall_id,
    name: row.name,
    committedAt: new Date(row.committed_at),
    reminderActive: row.reminder_active,
    lastRemindedAt: row.last_reminded_at ? new Date(row.last_reminded_at) : null,
  }
}

export class SupabasePrayerRepository implements IPrayerRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async findAllByWall(wallId: string): Promise<Prayer[]> {
    const { data, error } = await this.client
      .from('commitments')
      .select('id, wall_id, name, committed_at, reminder_active, last_reminded_at')
      .eq('wall_id', wallId)
      .order('committed_at', { ascending: true })

    if (error) throw new Error(error.message)
    return (data ?? []).map(rowToPrayer)
  }

  async findById(id: string): Promise<Prayer | null> {
    const { data, error } = await this.client
      .from('commitments')
      .select('id, wall_id, name, committed_at, reminder_active, last_reminded_at')
      .eq('id', id)
      .maybeSingle()

    if (error) throw new Error(error.message)
    return data ? rowToPrayer(data) : null
  }

  async create(data: CreatePrayerData): Promise<Prayer> {
    const { data: commitment, error: commitError } = await this.client
      .from('commitments')
      .insert({
        wall_id: data.wallId,
        name: data.name,
        email: data.email,
      })
      .select('id, wall_id, name, committed_at, reminder_active, last_reminded_at')
      .single()

    if (commitError) throw new Error(commitError.message)

    const categoryRows = data.categoryIds.map((categoryId) => ({
      commitment_id: commitment.id,
      category_id: categoryId,
    }))

    if (categoryRows.length > 0) {
      const { error: catError } = await this.client
        .from('commitment_categories')
        .insert(categoryRows)
      if (catError) throw new Error(catError.message)
    }

    return rowToPrayer(commitment)
  }

  async setReminderActive(id: string, active: boolean): Promise<void> {
    const { error } = await this.client
      .from('commitments')
      .update({ reminder_active: active })
      .eq('id', id)

    if (error) throw new Error(error.message)
  }
}
