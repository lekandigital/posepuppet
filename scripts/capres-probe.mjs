// Does --use-file-for-fake-video-capture honor downscale constraints?
import { chromium } from '@playwright/test';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PP = `http://localhost:${process.env.PP_PORT ?? '5173'}`;
const clip = resolve(ROOT, 'fixtures/rowing/rowing_slow.y4m');

const browser = await chromium.launch({
  headless: false,
  args: [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    `--use-file-for-fake-video-capture=${clip}`,
    '--autoplay-policy=no-user-gesture-required',
  ],
});
const page = await browser.newPage();
await page.goto(`${PP}/flight/?row`);
await page.waitForFunction(() => window.__POSE_RT?.state() === 'running', undefined, {
  timeout: 60_000,
});
const dims = await page.evaluate(() => {
  const v = window.__POSE_RT.video;
  const track = window.__POSE_RT.mediaStream()?.getVideoTracks()[0];
  return {
    videoW: v.videoWidth,
    videoH: v.videoHeight,
    trackSettings: track ? { w: track.getSettings().width, h: track.getSettings().height } : null,
  };
});
console.log(JSON.stringify(dims));
await browser.close();
