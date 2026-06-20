import { useState, useRef } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../../infrastructure/supabase/types'
import { Upload, CheckCircle } from 'lucide-react'

const MAX_BYTES = 15 * 1024 * 1024
const BUCKET = (import.meta.env.VITE_ASSETS_BUCKET as string | undefined)?.trim() || 'wall-assets'
const FOLDER = 'stone'
const STONE_PATH = `${FOLDER}/stone.jpg`
const LS_KEY = 'prayer-wall:stone-texture'

const LOGO_FOLDER = 'logo'
const LOGO_PATH = `${LOGO_FOLDER}/logo.png`
const LOGO_LS_KEY = 'prayer-wall:logo'

interface AssetAdminProps {
  supabase: SupabaseClient<Database>
  onDone?: () => void
}

export function AssetAdmin({ supabase, onDone }: AssetAdminProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    localStorage.getItem(LS_KEY),
  )
  const inputRef = useRef<HTMLInputElement>(null)

  const [logoUploading, setLogoUploading] = useState(false)
  const [logoError, setLogoError] = useState('')
  const [logoSuccess, setLogoSuccess] = useState(false)
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(
    localStorage.getItem(LOGO_LS_KEY),
  )
  const logoInputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setError('')
    setSuccess(false)

    if (file.size > MAX_BYTES) {
      setError(`File exceeds 15 MB limit (${(file.size / 1024 / 1024).toFixed(1)} MB)`)
      return
    }
    if (!file.type.startsWith('image/')) {
      setError('File must be an image (JPG, PNG, WebP)')
      return
    }

    setUploading(true)
    try {
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(STONE_PATH, file, { upsert: true, contentType: file.type })

      if (uploadError) throw new Error(uploadError.message)

      const { data } = supabase.storage.from(BUCKET).getPublicUrl(STONE_PATH)
      const publicUrl = data.publicUrl
      const cacheBusted = `${publicUrl}?t=${Date.now()}`

      localStorage.setItem(LS_KEY, cacheBusted)
      document.documentElement.style.setProperty('--stone-texture-url', `url(${cacheBusted})`)
      setPreviewUrl(cacheBusted)
      setSuccess(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  async function handleLogoFile(file: File) {
    setLogoError('')
    setLogoSuccess(false)
    if (file.size > MAX_BYTES) {
      setLogoError(`File exceeds 15 MB limit (${(file.size / 1024 / 1024).toFixed(1)} MB)`)
      return
    }
    if (!file.type.startsWith('image/')) {
      setLogoError('File must be an image (JPG, PNG, WebP, SVG)')
      return
    }
    setLogoUploading(true)
    try {
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(LOGO_PATH, file, { upsert: true, contentType: file.type })
      if (uploadError) throw new Error(uploadError.message)
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(LOGO_PATH)
      const cacheBusted = `${data.publicUrl}?t=${Date.now()}`
      localStorage.setItem(LOGO_LS_KEY, cacheBusted)
      document.documentElement.style.setProperty('--logo-url', `url(${cacheBusted})`)
      setLogoPreviewUrl(cacheBusted)
      setLogoSuccess(true)
    } catch (e) {
      setLogoError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setLogoUploading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h2 className="text-lg font-semibold text-stone-800">Stone Texture Asset</h2>
      <p className="text-sm text-stone-500">
        Upload the HCA cobblestone texture (JPG/PNG/WebP, max 15 MB).
        The prayer wall updates immediately in this browser session.
        Other sessions pick up the new texture on next page load.
      </p>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && (
        <p className="flex items-center gap-1.5 text-sm text-green-700">
          <CheckCircle size={14} /> Texture updated successfully
        </p>
      )}

      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-stone-300 rounded-xl p-10 text-center cursor-pointer hover:border-amber-400 transition-colors"
      >
        <Upload className="mx-auto mb-3 text-stone-400" size={32} />
        <p className="text-sm text-stone-500">
          {uploading ? 'Uploading...' : 'Drop image here or click to browse'}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleChange}
        />
      </div>

      {previewUrl && (
        <div>
          <p className="text-xs text-stone-400 mb-2">Current texture (from last upload)</p>
          <img
            src={previewUrl}
            alt="Stone texture preview"
            className="w-32 h-24 object-cover rounded-lg border border-stone-200"
          />
        </div>
      )}
      {/* Logo upload */}
      <div className="border-t border-stone-200 pt-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-stone-800">Header Logo</h2>
          <p className="text-sm text-stone-500 mt-0.5">
            Upload a custom logo image to replace the default triangle mark in the header.
            PNG or SVG with transparency works best. Max 15 MB.
          </p>
        </div>

        {logoError && <p className="text-sm text-red-600">{logoError}</p>}
        {logoSuccess && (
          <p className="flex items-center gap-1.5 text-sm text-green-700">
            <CheckCircle size={14} /> Logo updated successfully
          </p>
        )}

        <div
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) void handleLogoFile(f) }}
          onDragOver={e => e.preventDefault()}
          onClick={() => logoInputRef.current?.click()}
          className="border-2 border-dashed border-stone-300 rounded-xl p-10 text-center cursor-pointer hover:border-amber-400 transition-colors"
        >
          <Upload className="mx-auto mb-3 text-stone-400" size={32} />
          <p className="text-sm text-stone-500">
            {logoUploading ? 'Uploading...' : 'Drop image here or click to browse'}
          </p>
          <input
            ref={logoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) void handleLogoFile(f) }}
          />
        </div>

        {logoPreviewUrl && (
          <div>
            <p className="text-xs text-stone-400 mb-2">Current logo (from last upload)</p>
            <img
              src={logoPreviewUrl}
              alt="Logo preview"
              className="w-16 h-16 object-contain rounded-lg border border-stone-200 bg-stone-50 p-1"
            />
          </div>
        )}
      </div>

      <div className="border-t border-stone-200 pt-6 flex justify-end">
        <button
          onClick={onDone}
          className="px-6 py-2.5 rounded-md bg-amber-600 hover:bg-amber-500 text-stone-950 text-sm font-semibold transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  )
}
