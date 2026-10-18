import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../supabase/types'
import type { IGuideImageStorage } from '../../domain/gateways/IGuideImageStorage'

export class SupabaseGuideImageStorage implements IGuideImageStorage {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async upload(path: string, image: Blob): Promise<string> {
    const bucket = this.supabase.storage.from('wall-assets')
    const { error } = await bucket.upload(path, image, { contentType: image.type })
    if (error) throw new Error(error.message)
    return bucket.getPublicUrl(path).data.publicUrl
  }
}
