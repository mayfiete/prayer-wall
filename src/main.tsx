import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { supabaseClient } from './infrastructure/supabase/client'
import { loadCachedTheme, fetchAndApplyTheme, applyTheme, THEME_DEFAULTS } from './infrastructure/theme'
import './index.css'
import App from './App.tsx'

const _LS_KEY = 'prayer-wall:stone-texture'
const _LOGO_LS_KEY = 'prayer-wall:logo'
const _BUCKET = (import.meta.env.VITE_ASSETS_BUCKET as string | undefined)?.trim() || 'wall-assets'
const _STONE_FOLDER = 'stone'
const _LOGO_FOLDER = 'logo'

function _applyTexture(url: string) {
  document.documentElement.style.setProperty('--stone-texture-url', `url(${url})`)
}

function _applyLogo(url: string) {
  document.documentElement.style.setProperty('--logo-url', `url(${url})`)
}

const _useMock = import.meta.env.VITE_USE_MOCK === 'true'
const _wallId = (import.meta.env.VITE_WALL_ID as string | undefined)?.trim()

// Apply cached theme immediately to avoid flash
loadCachedTheme()

if (_useMock || !supabaseClient) {
  applyTheme(THEME_DEFAULTS)
  // Local / mock mode — use the bundled texture from the public folder
  _applyTexture('/textures/stone.jpg')
} else {
  // Apply cached assets immediately to avoid flash on load
  try {
    const cached = localStorage.getItem(_LS_KEY)
    if (cached && /^https?:\/\//.test(cached)) _applyTexture(cached)
    const cachedLogo = localStorage.getItem(_LOGO_LS_KEY)
    if (cachedLogo && /^https?:\/\//.test(cachedLogo)) _applyLogo(cachedLogo)
  } catch { /* private browsing */ }

  ;(async () => {
    // Fetch theme, texture, and logo in parallel
    await Promise.all([
      _wallId ? fetchAndApplyTheme(supabaseClient, _wallId) : Promise.resolve(),
      (async () => {
        const { data: files } = await supabaseClient.storage.from(_BUCKET).list(_STONE_FOLDER)
        const matches = (files ?? []).filter(f => /^stone\./i.test(f.name))
        if (matches.length === 0) return
        const picked = matches[Math.floor(Math.random() * matches.length)]
        const { data } = supabaseClient.storage.from(_BUCKET).getPublicUrl(`${_STONE_FOLDER}/${picked.name}`)
        if (data?.publicUrl) {
          _applyTexture(data.publicUrl)
          try { localStorage.setItem(_LS_KEY, data.publicUrl) } catch { /* ignore */ }
        }
      })(),
      (async () => {
        const { data: files } = await supabaseClient.storage.from(_BUCKET).list(_LOGO_FOLDER)
        const matches = (files ?? []).filter(f => /^logo\./i.test(f.name))
        if (matches.length === 0) return
        const { data } = supabaseClient.storage.from(_BUCKET).getPublicUrl(`${_LOGO_FOLDER}/${matches[0].name}`)
        if (data?.publicUrl) {
          _applyLogo(data.publicUrl)
          try { localStorage.setItem(_LOGO_LS_KEY, data.publicUrl) } catch { /* ignore */ }
        }
      })(),
    ])
  })()
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
