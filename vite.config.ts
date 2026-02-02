
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // Define caminhos relativos para assets (Vital para itch.io)
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false
  }
})
