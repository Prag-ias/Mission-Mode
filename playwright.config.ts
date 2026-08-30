import { config } from 'dotenv'
import { defineConfig } from '@playwright/test'

config({ path: '.env.local' })

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  // One user, one flow — parallel workers would race on the shared daily_logs row.
  workers: 1,
  use: {
    baseURL: 'http://localhost:3100',
    viewport: { width: 390, height: 844 }, // the phone the app is designed for
  },
  webServer: {
    command: 'npm run dev -- -p 3100',
    url: 'http://localhost:3100',
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
