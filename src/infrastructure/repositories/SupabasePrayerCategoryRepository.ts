// src/infrastructure/repositories/SupabasePrayerCategoryRepository.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../supabase/types'
import type {
  IPrayerCategoryRepository,
  CreateCategoryData,
  UpdateCategoryData,
} from '../../domain/repositories/IPrayerCategoryRepository'
import type { PrayerCategory } from '../../domain/entities/PrayerCategory'
import { NotFoundError } from '../../domain/errors/DomainError'

type DB = Database['prayer_wall']['Tables']
type CategoryRow = DB['message_categories']['Row']

function rowToCategory(row: CategoryRow): PrayerCategory {
  return {
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    displayOrder: row.display_order,
    isActive: row.is_active,
  }
}

export class SupabasePrayerCategoryRepository implements IPrayerCategoryRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async findActiveByOrg(orgId: string): Promise<PrayerCategory[]> {
    const { data, error } = await this.client
      .from('message_categories')
      .select('*')
      .eq('org_id', orgId)
      .eq('is_active', true)
      .order('display_order', { ascending: true })
    if (error) throw new Error(error.message)
    return ((data ?? []) as CategoryRow[]).map(rowToCategory)
  }

  async findAllByOrg(orgId: string): Promise<PrayerCategory[]> {
    const { data, error } = await this.client
      .from('message_categories')
      .select('*')
      .eq('org_id', orgId)
      .order('display_order', { ascending: true })
    if (error) throw new Error(error.message)
    return ((data ?? []) as CategoryRow[]).map(rowToCategory)
  }

  async create(data: CreateCategoryData): Promise<PrayerCategory> {
    const { data: row, error } = await this.client
      .from('message_categories')
      .insert({ org_id: data.orgId, name: data.name.trim(), display_order: data.displayOrder })
      .select()
      .single()
    if (error) throw new Error(error.message)
    return rowToCategory(row as CategoryRow)
  }

  async update(id: string, data: UpdateCategoryData): Promise<PrayerCategory> {
    if (data.name === undefined && data.displayOrder === undefined) {
      // No-op patch: fetch and return current state without a write round-trip
      const { data: row, error } = await this.client
        .from('message_categories')
        .select()
        .eq('id', id)
        .single()
      if (error) {
        if (error.code === 'PGRST116') throw new NotFoundError('Category')
        throw new Error(error.message)
      }
      if (!row) throw new NotFoundError('Category')
      return rowToCategory(row as CategoryRow)
    }

    const patch: DB['message_categories']['Update'] = {}
    if (data.name !== undefined) patch.name = data.name.trim()
    if (data.displayOrder !== undefined) patch.display_order = data.displayOrder

    const { data: row, error } = await this.client
      .from('message_categories')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    if (error) {
      if (error.code === 'PGRST116') throw new NotFoundError('Category')
      throw new Error(error.message)
    }
    if (!row) throw new NotFoundError('Category')
    return rowToCategory(row as CategoryRow)
  }

  async setActive(id: string, active: boolean): Promise<void> {
    const { error } = await this.client
      .from('message_categories')
      .update({ is_active: active })
      .eq('id', id)
      .select('id')
      .single()
    if (error) {
      if (error.code === 'PGRST116') throw new NotFoundError('Category')
      throw new Error(error.message)
    }
  }

  async delete(id: string): Promise<void> {
    const { error, count } = await this.client
      .from('message_categories')
      .delete({ count: 'exact' })
      .eq('id', id)
    if (error) throw new Error(error.message)
    if (count === 0) throw new NotFoundError('Category')
  }
}
