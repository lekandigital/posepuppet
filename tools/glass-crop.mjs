#!/usr/bin/env node
/* glass-crop.mjs — crop a region of an image at a zoom factor, with an
   optional 50px grid overlay, for precise geometry measurement.
   Usage: node tools/glass-crop.mjs <img> <x> <y> <w> <h> [zoom] [out] */

import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const [img, x, y, w, h, zoom = '2', out = 'eval/glass-compare/crop.png'] =
  process.argv.slice(2);
const [X, Y, W, H, Z] = [x, y, w, h, zoom].map(Number);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W * Z, height: H * Z } });
const src = `data:image/png;base64,${readFileSync(img).toString('base64')}`;
await page.setContent(`<body style="margin:0"><canvas id="c" width="${W * Z}" height="${H * Z}"></canvas></body>`);
await page.evaluate(async ({ src, X, Y, W, H, Z }) => {
  const c = document.getElementById('c').getContext('2d');
  const i = new Image();
  await new Promise((r) => { i.onload = r; i.src = src; });
  c.imageSmoothingEnabled = false;
  c.drawImage(i, X, Y, W, H, 0, 0, W * Z, H * Z);
  // 50px grid in source coords
  c.strokeStyle = 'rgba(255,0,80,.5)'; c.fillStyle = 'rgba(255,0,80,.9)';
  c.font = '11px monospace';
  for (let gx = Math.ceil(X / 50) * 50; gx < X + W; gx += 50) {
    c.beginPath(); c.moveTo((gx - X) * Z, 0); c.lineTo((gx - X) * Z, H * Z); c.stroke();
    c.fillText(String(gx), (gx - X) * Z + 2, 12);
  }
  for (let gy = Math.ceil(Y / 50) * 50; gy < Y + H; gy += 50) {
    c.beginPath(); c.moveTo(0, (gy - Y) * Z); c.lineTo(W * Z, (gy - Y) * Z); c.stroke();
    c.fillText(String(gy), 2, (gy - Y) * Z + 12);
  }
}, { src, X, Y, W, H, Z });
await page.screenshot({ path: out });
console.log('wrote', out);
await browser.close();
