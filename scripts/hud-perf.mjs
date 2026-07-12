// V1 perf table: each game with the page-owned pose runtime, HUD on vs
// off, on the production same-origin topology (PosePuppet server serving
// /flight/ and /dolphin/). Headed on a real display only — SwiftShader
// numbers are meaningless for WebGL games (repo convention).
//
//   DISPLAY=:2 PP_PORT=5184 node scripts/hud-perf.mjs
//
// Writes eval/runtime-hud-perf.json. Floors: game 60 fps (hard floor 45)
// with pose >= 15 Hz; HUD preview cost itemized per degradation tier.

import { chromium } from '@playwright/test';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const PP = `http://localhost:${process.env.PP_PORT ?? '5173'}`;

const cachedClip = resolve(ROOT, '.local/cache/fake-camera/fullbody.y4m');
const clip = existsSync(cachedClip) ? cachedClip : resolve(ROOT, 'fixtures', 'fullbody.y4m');
if (!existsSync(clip)) {
  console.error(`fixture missing: ${clip}`);
  process.exit(1);
}

const SECONDS = Number(process.env.PERF_SECONDS ?? 15);

const rafSample = (seconds) =>
  new Promise((resolveP) => {
    let frames = 0;
    let longFrames = 0;
    let last = performance.now();
    const t0 = last;
    const tick = (now) => {
      frames++;
      if (now - last > 25) longFrames++;
      last = now;
      if (now - t0 < seconds * 1000) requestAnimationFrame(tick);
      else
        resolveP({
          fps: Math.round((frames / ((now - t0) / 1000)) * 10) / 10,
          longFramePct: Math.round(((100 * longFrames) / frames) * 10) / 10,
        });
    };
    requestAnimationFrame(tick);
  });

async function measure(browser, { name, url, ready, drive }) {
  const out = {};
  for (const hudOn of [true, false]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const sep = url.includes('?') ? '&' : '?';
    await page.goto(`${PP}${url}${hudOn ? '' : `${sep}hud=0`}`);
    await ready(page);
    if (hudOn) {
      // wait for the page pipeline to actually track
      await page
        .waitForFunction(
          () => {
            const rt = window.__POSE_RT;
            return rt && rt.state() === 'running' && rt.poseFps() > 5;
          },
          undefined,
          { timeout: 60_000 },
        )
        .catch(() => {});
    }
    await drive?.(page);
    await page.waitForTimeout(2000);
    const sample = await page.evaluate(rafSample, SECONDS);
    const pose = await page.evaluate(() => ({
      state: window.__POSE_RT?.state() ?? 'n/a',
      poseHz: Math.round((window.__POSE_RT?.poseFps() ?? 0) * 10) / 10,
    }));
    let hud = null;
    if (hudOn) {
      // itemize preview cost per tier
      hud = await page.evaluate(async () => {
        const h = window.__PP_HUD;
        if (!h) return null;
        const tiers = {};
        for (const t of [0, 1, 2]) {
          h.setPreviewTier(t);
          await new Promise((r) => setTimeout(r, 2500));
          tiers[`tier${t}DrawMs`] = Math.round(h.stats().drawMsAvg * 1000) / 1000;
        }
        h.setPreviewTier(null);
        return { ...tiers, pageFpsSeen: Math.round(h.stats().pageFps) };
      });
    }
    out[hudOn ? 'hudOn' : 'hudOff'] = { ...sample, ...pose, hud };
    await page.close();
  }
  console.log(name, JSON.stringify(out));
  return out;
}

const browser = await chromium.launch({
  headless: false,
  args: [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    `--use-file-for-fake-video-capture=${clip}`,
    '--autoplay-policy=no-user-gesture-required',
  ],
});

const results = {
  generatedAt: new Date().toISOString(),
  display: process.env.DISPLAY ?? '(default)',
  fixture: clip,
  seconds: SECONDS,
  games: {},
};

results.games.flight = await measure(browser, {
  name: 'flight',
  url: '/flight/?autostart=1',
  ready: async (page) => {
    await page.waitForFunction(
      () => {
        const f = window.__FLIGHT;
        const s = f?.state();
        return !!s && s.phase === 'flying' && s.controlsEnabled === true;
      },
      undefined,
      { timeout: 60_000 },
    );
  },
  drive: async (page) => {
    await page.keyboard.down('w');
    page.once('close', () => {});
  },
});

results.games.rowing = await measure(browser, {
  name: 'rowing',
  url: '/flight/?autostart=1&row',
  ready: async (page) => {
    await page.waitForFunction(() => !!window.__FLIGHT?.state(), undefined, { timeout: 60_000 });
    await page.waitForTimeout(3000);
  },
});

results.games.dolphin = await measure(browser, {
  name: 'dolphin',
  url: '/dolphin/',
  ready: async (page) => {
    await page.waitForFunction(() => {
      const d = window.__DOLPHIN;
      return !!d && d.state().inWater === true;
    }, undefined, { timeout: 60_000 });
  },
  drive: async (page) => {
    await page.keyboard.down('w');
  },
});

await browser.close();

mkdirSync(resolve(ROOT, 'eval'), { recursive: true });
writeFileSync(
  resolve(ROOT, 'eval/runtime-hud-perf.json'),
  JSON.stringify(results, null, 2) + '\n',
);
console.log('wrote eval/runtime-hud-perf.json');
