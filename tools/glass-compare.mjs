#!/usr/bin/env node
/* glass-compare.mjs — screenshot the glass replica at reference size and
   emit comparison images against glass-assets/reference.png:
     <out>/replica.png       raw screenshot
     <out>/side-by-side.png  replica | reference
     <out>/blend.png         50/50 blend (misalignments show as ghosting)
   Usage: node tools/glass-compare.mjs [--url URL] [--out DIR]
   Expects the vite dev server (npm run dev) unless --url is given. */

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : dflt;
};
const url = arg('--url', 'http://localhost:5173/glass-replica.html?noscale');
const out = resolve(arg('--out', 'eval/glass-compare'));
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1535, height: 1024 } });
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/replica.png` });

// composite views rendered in-browser (no extra deps)
const { readFileSync } = await import('node:fs');
const b64 = (p) => `data:image/png;base64,${readFileSync(p).toString('base64')}`;
const repSrc = b64(`${out}/replica.png`);
const refSrc = b64('glass-assets/reference.png');

const composite = await browser.newPage({ viewport: { width: 1535, height: 1024 } });
const mk = async (drawJs, file, width) => {
  await composite.setViewportSize({ width, height: 1024 });
  await composite.setContent(`<body style="margin:0"><canvas id="c" width="${width}" height="1024"></canvas></body>`);
  await composite.evaluate(async ({ drawJs, repSrc, refSrc }) => {
    const c = document.getElementById('c').getContext('2d');
    const load = (src) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = src; });
    const [a, b] = await Promise.all([load(repSrc), load(refSrc)]);
    // eslint-disable-next-line no-new-func
    new Function('c', 'a', 'b', drawJs)(c, a, b);
  }, { drawJs, repSrc, refSrc });
  await composite.screenshot({ path: `${out}/${file}` });
};

await mk('c.drawImage(a,0,0); c.drawImage(b,1535,0);', 'side-by-side.png', 3070);
await mk('c.drawImage(a,0,0); c.globalAlpha=.5; c.drawImage(b,0,0);', 'blend.png', 1535);

console.log('wrote', out);
await browser.close();
