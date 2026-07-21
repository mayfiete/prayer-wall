import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../supabase/types'
import type { IPrayerMeditationRepository, CreateMeditationData, UpdateMeditationData } from '../../domain/repositories/IPrayerMeditationRepository'
import type { PrayerMeditation } from '../../domain/entities/PrayerMeditation'
import { NotFoundError } from '../../domain/errors/DomainError'

type MeditationRow = Database['prayer_wall']['Tables']['prayer_meditations']['Row']

function rowToMeditation(row: MeditationRow): PrayerMeditation {
  return {
    id: row.id,
    categoryId: row.category_id,
    orgId: row.org_id,
    body: row.body,
    displayOrder: row.display_order ?? 0,
    isActive: row.is_active ?? true,
    createdAt: new Date(row.created_at ?? ''),
  }
}

export class SupabasePrayerMeditationRepository implements IPrayerMeditationRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async findByCategory(categoryId: string): Promise<PrayerMeditation[]> {
    const { data, error } = await this.client
      .from('prayer_meditations')
      .select('*')
      .eq('category_id', categoryId)
      .order('display_order', { ascending: true })
    if (error) throw new Error(error.message)
    return ((data ?? []) as MeditationRow[]).map(rowToMeditation)
  }

  async findActiveByCategory(categoryId: string): Promise<PrayerMeditation[]> {
    const { data, error } = await this.client
      .from('prayer_meditations')
      .select('*')
      .eq('category_id', categoryId)
      .eq('is_active', true)
      .order('display_order', { ascending: true })
    if (error) throw new Error(error.message)
    return ((data ?? []) as MeditationRow[]).map(rowToMeditation)
  }

  async create(data: CreateMeditationData): Promise<PrayerMeditation> {
    const { data: row, error } = await this.client
      .from('prayer_meditations')
      .insert({
        category_id: data.categoryId,
        org_id: data.orgId,
        body: data.body.trim(),
        display_order: data.displayOrder,
        is_active: true,
      })
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return rowToMeditation(row as MeditationRow)
  }

  async update(id: string, data: UpdateMeditationData): Promise<PrayerMeditation> {
    const patch: Partial<MeditationRow> = {}
    if (data.body !== undefined) patch.body = data.body.trim()
    if (data.displayOrder !== undefined) patch.display_order = data.displayOrder
    const { data: row, error } = await this.client
      .from('prayer_meditations')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    if (!row) throw new NotFoundError('Meditation')
    return rowToMeditation(row as MeditationRow)
  }

  async setActive(id: string, active: boolean): Promise<void> {
    const { error } = await this.client
      .from('prayer_meditations')
      .update({ is_active: active })
      .eq('id', id)
    if (error) throw new Error(error.message)
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.client
      .from('prayer_meditations')
      .delete()
      .eq('id', id)
    if (error) throw new Error(error.message)
  }
}
