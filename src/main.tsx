import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

try {
  const storedTexture = localStorage.getItem('prayer-wall:stone-texture')
  if (storedTexture && /^(https?:\/\/|data:image\/)/.test(storedTexture)) {
    document.documentElement.style.setProperty('--stone-texture-url', `url(${storedTexture})`)
  }
} catch {
  // localStorage unavailable (private browsing, security policy); CSS fallback applies
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
