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
      // Enforced coverage floors (CD-139 M1 gate). Kernel/services are held to the
      // gate's 85%/75% intent via these global minimums; CI fails below them.
      thresholds: {
        statements: 85,
        branches: 80,
        functions: 78,
        lines: 85,
      },
    },
  },
})
