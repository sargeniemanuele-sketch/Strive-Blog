import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/',
  define: {
    global: 'globalThis',
  },
  server: {
    port: 3001,
    strictPort: true, // errore esplicito se la porta è occupata (no salti silenziosi)
  },
})
