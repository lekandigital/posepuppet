import { defineConfig } from '@playwright/test';

const GAME_PORT = process.env.OPENWORLD_PORT ?? '5176';

// Open World suite — separate from the root suite (the Dolphin/Flight/
// Walking convention). Port 5176 is the V4 lane port. Correctness runs
// headless; recordings/perf run headed on DISPLAY=:2 under the display
// lock.
export default defineConfig({
  testDir: './tests',
  timeout: 120_000,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${GAME_PORT}`,
    viewport: { width: 1280, height: 720 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: `npm run dev -- --port ${GAME_PORT} --strictPort`,
      url: `http://localhost:${GAME_PORT}/openworld/`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});
