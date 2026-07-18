import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Checkpoint 00 scaffold suite (headed, 1728×1080 — see playwright.config.ts):
//  1. the pristine stock jeantimex demo boots at /shared-world/?view=stock
//     with no console errors, a painted WebGL2 canvas, and sustained
//     median fps ≥ 58 (native macOS GPU; asserted unconditionally).
//  2. the vendored tree is byte-identical to the SHA-256 manifest recorded
//     in VENDOR.md (guards accidental vendored edits from this checkpoint
//     forward).

const here = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = resolve(here, '..');
const REPO_ROOT = resolve(APP_ROOT, '..', '..');
const VENDOR_ROOT = join(APP_ROOT, 'vendor', 'threejs-water');

function walkFiles(dir: string, base: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walkFiles(full, base));
    else out.push('./' + full.slice(base.length + 1).split('\\').join('/'));
  }
  return out;
}

test('vendored jeantimex tree matches the VENDOR.md integrity manifest', () => {
  const vendorMd = readFileSync(join(VENDOR_ROOT, 'VENDOR.md'), 'utf8');
  const recorded = vendorMd.match(/Aggregate manifest SHA-256:\*\* `([0-9a-f]{64})`/)?.[1];
  expect(recorded, 'VENDOR.md must record the aggregate manifest hash').toBeTruthy();

  const paths = walkFiles(VENDOR_ROOT, VENDOR_ROOT)
    .filter((p) => p !== './VENDOR.md')
    // C-locale byte order, matching `find | LC_ALL=C sort` in VENDOR.md.
    .sort();
  expect(paths.length).toBe(78);

  // Reproduce `shasum -a 256` output format exactly: "<hex>  <path>\n".
  let manifest = '';
  for (const p of paths) {
    const hash = createHash('sha256').update(readFileSync(join(VENDOR_ROOT, p))).digest('hex');
    manifest += `${hash}  ${p}\n`;
  }
  const aggregate = createHash('sha256').update(manifest).digest('hex');
  expect(aggregate, 'vendored files were modified — vendor/ must stay byte-identical').toBe(
    recorded,
  );
});

test('stock demo boots clean, paints WebGL2, and sustains 58+ fps', async ({ page, browser }) => {
  // The browser probes /favicon.ico on its own; neither this shell nor the
  // upstream demo references one (upstream 404s it identically). That
  // browser-chrome artifact is excluded; every resource the demo actually
  // loads still asserts clean.
  const isFaviconProbe = (s: string) => s.includes('/favicon.ico');
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const loc = msg.location();
      const text = `${msg.text()}${loc.url ? ` [${loc.url}]` : ''}`;
      if (!isFaviconProbe(text)) consoleErrors.push(text);
    }
  });
  page.on('pageerror', (err) => consoleErrors.push(String(err)));
  page.on('response', (res) => {
    if (res.status() >= 400 && !isFaviconProbe(res.url())) {
      consoleErrors.push(`HTTP ${res.status()} ${res.url()}`);
    }
  });

  await page.goto('/shared-world/?view=stock');

  // Let assets load and the render loop settle.
  await page.waitForSelector('#loading', { state: 'hidden', timeout: 30_000 });
  await page.waitForTimeout(3_000);

  expect(consoleErrors, `console errors: ${consoleErrors.join(' | ')}`).toEqual([]);

  // A WebGL2 canvas is present.
  const isWebgl2 = await page.evaluate(() => {
    const canvas = document.querySelector('#app canvas') as HTMLCanvasElement | null;
    return !!canvas && canvas.getContext('webgl2') !== null;
  });
  expect(isWebgl2, 'expected a WebGL2 canvas under #app').toBe(true);

  // The canvas is painted: screenshot it, decode in-page, count pixels that
  // differ from the top-left corner pixel (> 500 non-background pixels).
  const shot = await page.locator('#app canvas').screenshot();
  const painted = await page.evaluate(async (b64: string) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    const r0 = d[0]!, g0 = d[1]!, b0 = d[2]!;
    let count = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (
        Math.abs(d[i]! - r0) > 8 ||
        Math.abs(d[i + 1]! - g0) > 8 ||
        Math.abs(d[i + 2]! - b0) > 8
      ) {
        count++;
      }
    }
    return count;
  }, shot.toString('base64'));
  expect(painted, 'canvas should have > 500 non-background pixels').toBeGreaterThan(500);

  // fps over 10 s (superset of the required 5 s), 1 s buckets → median/min.
  const buckets = await page.evaluate(
    () =>
      new Promise<number[]>((done) => {
        const counts: number[] = [];
        let frames = 0;
        const bucket = () => {
          counts.push(frames);
          frames = 0;
          if (counts.length >= 10) done(counts);
          else setTimeout(bucket, 1000);
        };
        const tick = () => {
          frames++;
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        setTimeout(bucket, 1000);
      }),
  );
  const sorted = [...buckets].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)]!;
  const min = sorted[0]!;

  const dpr = await page.evaluate(() => window.devicePixelRatio);
  const canvasSize = await page.evaluate(() => {
    const c = document.querySelector('#app canvas') as HTMLCanvasElement;
    return { width: c.width, height: c.height };
  });

  // Committed-artifact convention (Track A F12): results to repo-root eval/.
  // Since checkpoint 01 this file is shared with the pool suite — merge
  // under the `stock` key instead of overwriting (the assertions above are
  // unchanged from checkpoint 00; this is artifact bookkeeping only).
  const stock = {
    timestamp: new Date().toISOString(),
    url: '/shared-world/?view=stock',
    viewport: { width: 1728, height: 1080 },
    devicePixelRatio: dpr,
    renderResolution: canvasSize,
    chromeVersion: browser.version(),
    fps: { buckets, median, min, windowSeconds: 10 },
    simHz: null,
    simHzNote: 'not applicable — the stock view has no sim (fidelity reference)',
    consoleErrors: consoleErrors.length,
    paintedPixels: painted,
  };
  mkdirSync(join(REPO_ROOT, 'eval'), { recursive: true });
  const resultsPath = join(REPO_ROOT, 'eval', 'shared-world-results.json');
  const existing = existsSync(resultsPath)
    ? (JSON.parse(readFileSync(resultsPath, 'utf8')) as Record<string, unknown>)
    : {};
  writeFileSync(resultsPath, JSON.stringify({ ...existing, stock }, null, 2) + '\n');

  expect(median, `median fps ${median} (buckets: ${buckets.join(',')})`).toBeGreaterThanOrEqual(58);
});
