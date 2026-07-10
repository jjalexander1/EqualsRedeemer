import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: [
      'equalsredeemer.com',
      'www.equalsredeemer.com',
      'equalsredeemer.localhost',
      'localhost',
    ],
  },
  preview: {
    allowedHosts: [
      'equalsredeemer.com',
      'www.equalsredeemer.com',
      'equalsredeemer.localhost',
      'localhost',
    ],
  },
})
