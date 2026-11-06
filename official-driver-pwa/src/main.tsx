import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const liveMode = new URLSearchParams(window.location.search).get('live') === '1'
const getAccessToken = async (): Promise<string | null> => {
  const entry = document.cookie.split(';').map(part => part.trim()).find(part => part.startsWith('xdrive-route-access-token='))
  if (!entry) return null
  try { return decodeURIComponent(entry.slice('xdrive-route-access-token='.length)) || null }
  catch { return null }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App {...(liveMode ? { getAccessToken } : {})} />
  </StrictMode>,
)

// Legacy root-scoped Service Worker is retired by the host application.
// This integrated PWA must not re-register /sw.js in either mode.
