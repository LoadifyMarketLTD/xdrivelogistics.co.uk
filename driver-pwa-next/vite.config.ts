import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  base: '/driver/reserve-next/',
  plugins: [react()],
  // Local production-preview uses the same real driver API as Netlify.
  // Keep this proxy confined to NEXT preview; Reserve and production are unchanged.
  preview: { proxy: { '/api': { target: 'https://www.xdrivelogistics.co.uk', changeOrigin: true } } },
  server: { allowedHosts: ['quick-pumas-teach.loca.lt', 'hip-papers-type.loca.lt'], proxy: { '/xdrive-api': { target: 'https://www.xdrivelogistics.co.uk', changeOrigin: true, rewrite: (path: string) => path.replace(/^\/xdrive-api/, '/api') } } },
})
