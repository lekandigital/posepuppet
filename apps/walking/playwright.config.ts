import { defineConfig } from '@playwright/test';

const GAME_PORT = process.env.WALKING_PORT ?? '5175';

// Walking graybox suite — separate from the root suite so both stay
// independently green (the Dolphin/Flight convention). Port 5175 is the
// V3 lane port from the prompt pack. Synthetic-driver specs need no
// camera and no producer server; the denied/live specs manage their own
// browser flags. Headed runs (DISPLAY=:2 under the display lock) are for
// recordings and perf only; correctness runs headless.
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
      url: `http://localhost:${GAME_PORT}/walking/`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});
