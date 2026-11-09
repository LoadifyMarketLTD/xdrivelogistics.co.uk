import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  base: '/driver/official-pwa/',
  plugins: [react()],
  server: {
    allowedHosts: ['quick-pumas-teach.loca.lt', 'hip-papers-type.loca.lt'],
    proxy: {
      '/xdrive-api': {
        target: 'https://www.xdrivelogistics.co.uk',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => '/api' + path.slice('/xdrive-api'.length),
      },
    },
  },

})
