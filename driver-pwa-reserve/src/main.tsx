import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './ReserveApp.tsx'
import { installQaNetworkGuard } from './qaNetworkGuard.ts'

// Reserve QA defaults to READ-ONLY even when built as static assets.
// A future live release needs an explicit build flag AND the exact public origin.
const explicitLiveRelease = import.meta.env.VITE_XDRIVE_DRIVER_APPROVED_LIVE_WRITES === '1'
  && import.meta.env.PROD
  && location.origin === 'https://www.xdrivelogistics.co.uk';
const qaMode = !explicitLiveRelease
  || import.meta.env.DEV
  || import.meta.env.VITE_CX4A_QA_MOCK === '1'
  || location.pathname.startsWith('/driver/reserve-rebuild-qa/');
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
