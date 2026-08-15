import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './services/theme' // applies the stored theme before first paint
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// register the offline service worker in production builds only (skipped in dev
// to avoid stale-cache surprises while developing)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* offline support optional */ })
  })
}