import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../supabase/types'
import type { IPrayerCategoryRepository } from '../../domain/repositories/IPrayerCategoryRepository'
import type { PrayerCategory } from '../../domain/entities/PrayerCategory'

type DB = Database['public']['Tables']
type CategoryRow = DB['prayer_categories']['Row']

function rowToCategory(row: CategoryRow): PrayerCategory {
  return {
    id: row.id,
    churchId: row.church_id,
    name: row.name,
    displayOrder: row.display_order,
    isActive: row.is_active,
  }
}

export class SupabasePrayerCategoryRepository implements IPrayerCategoryRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async findActiveByChurch(churchId: string): Promise<PrayerCategory[]> {
    const { data, error } = await this.client
      .from('prayer_categories')
      .select('*')
      .eq('church_id', churchId)
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    if (error) throw new Error(error.message)
    return ((data ?? []) as CategoryRow[]).map(rowToCategory)
  }
}
