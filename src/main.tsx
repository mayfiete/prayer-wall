import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createClient } from '@supabase/supabase-js'
import './index.css'
import App from './App.tsx'

const _LS_KEY = 'prayer-wall:stone-texture'
const _BUCKET = (import.meta.env.VITE_ASSETS_BUCKET as string | undefined)?.trim() || 'wall-assets'
const _STONE_PATH = 'stone/stone.jpg'

function _applyTexture(url: string) {
  document.documentElement.style.setProperty('--stone-texture-url', `url(${url})`)
}

// Apply cached texture immediately to avoid flash on load
try {
  const cached = localStorage.getItem(_LS_KEY)
  if (cached && /^https?:\/\//.test(cached)) _applyTexture(cached)
} catch { /* private browsing */ }

// Fetch authoritative public URL from Supabase so every browser gets the latest texture
const _supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim()
const _supabaseKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim()
if (_supabaseUrl && _supabaseKey) {
  const _client = createClient(_supabaseUrl, _supabaseKey)
  const { data: _textureData } = _client.storage.from(_BUCKET).getPublicUrl(_STONE_PATH)
  if (_textureData?.publicUrl) {
    _applyTexture(_textureData.publicUrl)
    try { localStorage.setItem(_LS_KEY, _textureData.publicUrl) } catch { /* ignore */ }
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
