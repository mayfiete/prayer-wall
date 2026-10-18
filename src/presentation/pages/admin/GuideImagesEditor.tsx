import { useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../../infrastructure/supabase/types'

interface Props {
  supabase: SupabaseClient<Database>
  wallId: string
  value: string
  onChange: (value: string) => void
  onBusy: (busy: boolean) => void
}

export function GuideImagesEditor({ supabase, wallId, value, onChange, onBusy }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const images = value.split('\n').map(url => url.trim()).filter(Boolean)

  async function upload(files: File[]) {
    setError('')
    if (!wallId) { setError('A wall ID is required.'); return }
    if (images.length + files.length > 10) { setError('You can add up to 10 images per guide.'); return }
    if (files.some(file => !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type) || file.size > 15 * 1024 * 1024)) {
      setError('Choose JPG, PNG, WebP or GIF images up to 15 MB each.')
      return
    }
    setBusy(true)
    onBusy(true)
    const added: string[] = []
    try {
      for (const file of files) {
        const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }[file.type]
        const path = `${wallId}/prayer-guide/${crypto.randomUUID()}.${extension}`
        const bucket = supabase.storage.from('wall-assets')
        const { error: uploadError } = await bucket.upload(path, file, { contentType: file.type })
        if (uploadError) throw uploadError
        added.push(bucket.getPublicUrl(path).data.publicUrl)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Image upload failed. Please try again.')
    } finally {
      if (added.length) onChange([...images, ...added].join('\n'))
      setBusy(false)
      onBusy(false)
    }
  }

  function move(index: number, offset: number) {
    const reordered = [...images]
    ;[reordered[index], reordered[index + offset]] = [reordered[index + offset], reordered[index]]
    onChange(reordered.join('\n'))
  }

  return <div className="space-y-3">
    <p className="text-sm font-medium text-stone-700">Images at the bottom of the guide</p>
    <p className="text-xs text-stone-500">Add up to 10 images. They appear below the closing text, above the email footer, in this order. Save your changes to include them in future guides. Images are publicly accessible.</p>
    {images.map((url, index) => <div key={`${url}-${index}`} className="border rounded p-3 space-y-2">
      <img src={url} alt={`Prayer guide image ${index + 1}`} className="max-h-48 max-w-full mx-auto" />
      <div className="flex gap-3 text-xs">
        <button type="button" disabled={busy || index === 0} onClick={() => move(index, -1)} className="disabled:opacity-40">Move up</button>
        <button type="button" disabled={busy || index === images.length - 1} onClick={() => move(index, 1)} className="disabled:opacity-40">Move down</button>
        <button type="button" disabled={busy} onClick={() => onChange(images.filter((_, i) => i !== index).join('\n'))} className="text-red-600">Remove</button>
      </div>
    </div>)}
    <label className="block text-sm text-stone-700">{busy ? 'Uploading images…' : 'Add images'}
      <input type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" disabled={busy} className="block mt-2 text-xs" onChange={event => {
        const files = Array.from(event.target.files ?? [])
        event.target.value = ''
        if (files.length) void upload(files)
      }} />
    </label>
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
  </div>
}
