// Playwright config (CD-136). Boots the built app via `vite preview` and drives
// the headless boot journey. Kept minimal for M1; more journeys land with the
// shell (M2). Browsers install with `pnpm exec playwright install chromium`.
import { defineConfig, devices } from '@playwright/test'

const PORT = 4319

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: true,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `pnpm build && pnpm preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
