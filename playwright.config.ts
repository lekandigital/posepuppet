import { defineConfig, type Project } from '@playwright/test';
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
const fakeCamera = process.env.POSEPUPPET_FAKE_CAMERA
  || (existsSync(cachedFixture) ? cachedFixture : originalFixture);

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

// Shared camera and media flags used by all tiers.
const cameraArgs = [
  '--use-fake-ui-for-media-stream',
  '--use-fake-device-for-media-stream',
  `--use-file-for-fake-video-capture=${fakeCamera}`,
  '--autoplay-policy=no-user-gesture-required',
];

// --- Projects / Tiers ---

// Default project: functional tests (SwiftShader on remote, native on Mac).
const defaultProject: Project = {
  name: 'default',
  use: {
    baseURL: 'http://localhost:5173',
    permissions: ['camera', 'microphone'],
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: {
      args: [...cameraArgs, ...swiftShaderArgs],
    },
  },
};

// GPU performance project: opt-in via POSEPUPPET_GPU_TESTS=1.
// Requires POSEPUPPET_GPU_DISPLAY to specify the NVIDIA-backed X display.
// Runs headed Chromium without SwiftShader on the specified display.
// The NVIDIA renderer preflight is performed by scripts/remote/gpu-preflight.mjs.
const gpuDisplay = process.env.POSEPUPPET_GPU_DISPLAY;
const gpuProject: Project | null =
  process.env.POSEPUPPET_GPU_TESTS && gpuDisplay
    ? {
        name: 'gpu-performance',
        testMatch: /detect\.spec\.ts/,
        use: {
          baseURL: 'http://localhost:5173',
          permissions: ['camera', 'microphone'],
          trace: 'retain-on-failure',
          screenshot: 'only-on-failure',
          launchOptions: {
            headless: false,
            args: [
              ...cameraArgs,
              '--no-sandbox',
              '--disable-gpu-sandbox',
              '--ignore-gpu-blocklist',
              '--enable-gpu-rasterization',
            ],
            env: { DISPLAY: gpuDisplay },
          },
        },
      }
    : null;

const projects: Project[] = [defaultProject];
if (gpuProject) projects.push(gpuProject);

export default defineConfig({
  testDir: 'tests',
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  projects,
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
