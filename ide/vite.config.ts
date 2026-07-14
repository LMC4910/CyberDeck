/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/shared/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'json-summary', 'html'],
      include: ['src/platform/**', 'src/services/**', 'src/stores/**', 'src/repositories/**'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/shared/contract/**', 'src/**/index.ts'],
      // Report-only floors for now (kernel 85% / services 75%); CD-139 flips these
      // to enforced thresholds at the M1 gate.
      thresholds: { autoUpdate: false },
    },
  },
})
