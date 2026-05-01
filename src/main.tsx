import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const storedTexture = localStorage.getItem('prayer-wall:stone-texture')
if (storedTexture) {
  document.documentElement.style.setProperty('--stone-texture-url', `url(${storedTexture})`)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
