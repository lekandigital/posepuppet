#!/usr/bin/env node
/**
 * GPU Renderer Preflight — verifies that an NVIDIA-backed browser is available.
 *
 * Usage:
 *   POSEPUPPET_GPU_DISPLAY=:N node scripts/remote/gpu-preflight.mjs
 *
 * Exit codes:
 *   0 = NVIDIA renderer confirmed, GPU performance tests permitted
 *   1 = Software/SwiftShader renderer, GPU performance tests NOT permitted
 *   2 = Error (could not launch browser or probe renderer)
 *
 * Does not hardcode display numbers, BusIDs, usernames, or paths.
 */
import { chromium } from 'playwright';

const DISPLAY = process.env.POSEPUPPET_GPU_DISPLAY || process.env.DISPLAY;
if (!DISPLAY) {
  console.error('ERROR: POSEPUPPET_GPU_DISPLAY or DISPLAY must be set.');
  process.exit(2);
}

console.log(`GPU Preflight — probing display ${DISPLAY}...`);

try {
  const browser = await chromium.launch({
    headless: false,
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--autoplay-policy=no-user-gesture-required',
      '--no-sandbox',
      '--disable-gpu-sandbox',
      '--ignore-gpu-blocklist',
      '--enable-gpu-rasterization',
    ],
    env: { ...process.env, DISPLAY },
  });

  const page = await browser.newPage();
  await page.goto('about:blank');

  const gpuInfo = await page.evaluate(() => {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return { webgl: false, webgl2: false, vendor: 'none', renderer: 'none' };
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      webgl: true,
      webgl2: !!c.getContext('webgl2'),
      vendor: dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : 'unknown',
      renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'unknown',
    };
  });

  await browser.close();

  const isNvidia = /nvidia/i.test(gpuInfo.renderer || '');
  const isSoftware = /swiftshader|llvmpipe|software|mesa/i.test(gpuInfo.renderer || '');

  console.log(JSON.stringify({
    display: DISPLAY,
    ...gpuInfo,
    nvidia: isNvidia,
    software: isSoftware,
    permitted: isNvidia && !isSoftware,
  }, null, 2));

  if (isNvidia && !isSoftware) {
    console.log('\n✓ NVIDIA renderer confirmed. GPU performance tests permitted.');
    process.exit(0);
  } else {
    console.log('\n✗ Renderer is NOT NVIDIA-accelerated. GPU performance tests NOT permitted.');
    process.exit(1);
  }
} catch (err) {
  console.error('Preflight failed:', err.message);
  process.exit(2);
}
