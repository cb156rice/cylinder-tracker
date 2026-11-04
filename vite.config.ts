import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Served from https://cb156rice.github.io/cylinder-tracker/
export default defineConfig({
  base: '/cylinder-tracker/',
  plugins: [react()],
})
