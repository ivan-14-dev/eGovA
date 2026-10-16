import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  timeout: 180_000,
  use: {
    baseURL: 'http://127.0.0.1:5187',
    viewport: { width: 1440, height: 1000 },
  },
  webServer: {
    command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 5187 --strictPort',
    url: 'http://127.0.0.1:5187',
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
