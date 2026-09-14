import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { applyTenantThemeCss, loadTenantTheme } from '@/lib/tenantTheme'
import './index.css'
import App from './App'

applyTenantThemeCss(loadTenantTheme())

registerSW({
  immediate: true,
  onOfflineReady() {
    console.info('[Duka+] App ready to work offline')
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
