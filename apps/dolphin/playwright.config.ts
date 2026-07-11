import { defineConfig } from '@playwright/test';

const PP_PORT = process.env.PP_PORT ?? '5173';

// BodyArcade Dolphin suite — separate from PosePuppet's root suite and the
// Flight suite so all three stay independently green. Port 5197 avoids
// PosePuppet's 5173 and Flight's 5199. Headed like the other game suites
// (headless WebGL gets compositor-throttled — the documented convention).
export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5197',
    viewport: { width: 1280, height: 720 },
  },
  webServer: [
    {
      command: 'npm run dev -- --port 5197 --strictPort',
      url: 'http://localhost:5197/dolphin/',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      // PosePuppet (the body-signal producer) for the closed-loop fixture
      // specs. PP_PORT because 5173 on the remote box can belong to a
      // DIFFERENT checkout's persistent server (measured 2026-07-11) —
      // strictPort + explicit port pins the producer to THIS tree.
      command: `npm run dev --prefix ../.. -- --port ${PP_PORT} --strictPort`,
      url: `http://localhost:${PP_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
