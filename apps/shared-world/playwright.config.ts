import { defineConfig } from '@playwright/test';

const PP_PORT = process.env.PP_PORT ?? '5173';
const GAME_PORT = process.env.SHARED_WORLD_PORT ?? '5198';
const ACCEPTANCE = process.env.SHARED_WORLD_ACCEPTANCE === '1';

const display = ACCEPTANCE
  ? {
      viewport: { width: 1728, height: 1080 },
      args: ['--window-position=0,0'],
    }
  : {
      viewport: { width: 1365, height: 768 },
      args: [
        '--window-position=153,-2529',
        '--window-size=1440,853',
      ],
    };

// BodyArcade Shared World suite — separate from PosePuppet's root suite and
// the Flight/Dolphin suites so all stay independently green. Port 5198
// avoids PosePuppet's 5173, Dolphin's 5197 and Flight's 5199. Headed like
// the other game suites (headless WebGL gets compositor-throttled — the
// documented convention). Local macOS native GPU only: no DISPLAY, no
// SwiftShader; the fps floor asserts unconditionally. Default local
// development runs use the rotated secondary display; set
// SHARED_WORLD_ACCEPTANCE=1 for the final 1728×1080 built-in-display pass.
export default defineConfig({
  testDir: './tests',
  timeout: 120_000,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${GAME_PORT}`,
    viewport: display.viewport,
    headless: false,
    channel: 'chrome',
    launchOptions: {
      args: [
        // --- Camera suppression (development-automation only) ---
        // Block camera/microphone permission prompts so the physical webcam
        // never activates during automated test runs. The app's keyboard
        // fallback and postMessage body-input pump remain fully functional.
        // To restore camera access for a live-camera checkpoint, comment
        // out the next line.
        '--deny-permission-prompts',

        // --- Deterministic window placement ---
        ...display.args,
      ],
    },
  },
  webServer: [
    {
      command: `npm run dev -- --port ${GAME_PORT} --strictPort`,
      url: `http://localhost:${GAME_PORT}/shared-world/`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      // PosePuppet (the body-signal producer) for later closed-loop fixture
      // specs; strictPort + explicit port pins the producer to THIS tree.
      command: `npm run dev --prefix ../.. -- --port ${PP_PORT} --strictPort`,
      url: `http://localhost:${PP_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
