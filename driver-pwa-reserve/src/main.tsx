import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './ReserveApp.tsx'
import { installQaNetworkGuard } from './qaNetworkGuard.ts'

// The official production PWA supports authorised operations by default.
// Local, preview and explicit QA builds remain isolated; server permissions remain authoritative.
const productionLive = import.meta.env.PROD
  && location.origin === 'https://www.xdrivelogistics.co.uk'
  && (location.pathname === '/driver/reserve-pwa/' || location.pathname === '/driver/reserve-pwa/index.html')
  && import.meta.env.VITE_CX4A_QA_MOCK !== '1';
const qaMode = !productionLive;
installQaNetworkGuard({
  origin: location.origin,
  qaMode,
  allowAuthLogin: import.meta.env.VITE_CX4A_QA_MOCK !== '1',
  allowSyntheticLocalWrites: import.meta.env.VITE_QA_SYNTHETIC_LOCAL_WRITES === '1',
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if (import.meta.env.PROD && !qaMode && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/driver/reserve-pwa/sw.js').catch(error => {
      console.error('Local PWA offline registration failed', error)
    })
  })
}
