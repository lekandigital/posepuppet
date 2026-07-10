import { defineConfig } from '@playwright/test';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

// Default fake-camera fixture; individual tests/eval runs relaunch with
// other clips via their own browser instances.
const here = dirname(fileURLToPath(import.meta.url));

// Prefer the pre-generated Y4M in the cache directory (remote),
// fall back to the original fixture directory (local Mac).
const cachedFixture = resolve(here, '.local', 'cache', 'fake-camera', 'arms_tpose.y4m');
const originalFixture = resolve(here, 'fixtures', 'arms.y4m');
const fixture = existsSync(cachedFixture) ? cachedFixture : originalFixture;

// SwiftShader args for remote headless functional testing.
// These are injected only when USE_SWIFTSHADER=1 is set.
const swiftShaderArgs = process.env.USE_SWIFTSHADER
  ? [
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--disable-accelerated-video-decode',
    ]
  : [];

export default defineConfig({
  testDir: 'tests',
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    permissions: ['camera', 'microphone'],
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: {
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        `--use-file-for-fake-video-capture=${fixture}`,
        '--autoplay-policy=no-user-gesture-required',
        ...swiftShaderArgs,
      ],
    },
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
