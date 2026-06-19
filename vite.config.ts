import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/8-bit-animate/',
  define: {
    __BUILD_ID__: JSON.stringify(new Date().toISOString()),
  },
})
