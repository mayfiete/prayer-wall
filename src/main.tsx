import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createClient } from '@supabase/supabase-js'
import './index.css'
import App from './App.tsx'

const _LS_KEY = 'prayer-wall:stone-texture'
const _BUCKET = (import.meta.env.VITE_ASSETS_BUCKET as string | undefined)?.trim() || 'wall-assets'
const _STONE_FOLDER = 'stone'

function _applyTexture(url: string) {
  document.documentElement.style.setProperty('--stone-texture-url', `url(${url})`)
}

const _supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim()
const _supabaseKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim()
const _useMock = import.meta.env.VITE_USE_MOCK === 'true'

if (_useMock || !_supabaseUrl || !_supabaseKey) {
  // Local / mock mode — use the bundled texture from the public folder
  _applyTexture('/textures/stone.jpg')
} else {
  // Apply cached texture immediately to avoid flash on load
  try {
    const cached = localStorage.getItem(_LS_KEY)
    if (cached && /^https?:\/\//.test(cached)) _applyTexture(cached)
  } catch { /* private browsing */ }

  // List stone/ folder, find all stone.* files, pick one randomly
  ;(async () => {
    const _client = createClient(_supabaseUrl, _supabaseKey)
    const { data: files } = await _client.storage.from(_BUCKET).list(_STONE_FOLDER)
    const matches = (files ?? []).filter(f => /^stone\./i.test(f.name))
    if (matches.length === 0) return
    const picked = matches[Math.floor(Math.random() * matches.length)]
    const { data } = _client.storage.from(_BUCKET).getPublicUrl(`${_STONE_FOLDER}/${picked.name}`)
    if (data?.publicUrl) {
      _applyTexture(data.publicUrl)
      try { localStorage.setItem(_LS_KEY, data.publicUrl) } catch { /* ignore */ }
    }
  })()
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
