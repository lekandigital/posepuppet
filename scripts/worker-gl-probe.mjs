// One-off: is worker OffscreenCanvas WebGL hardware-accelerated here?
import { chromium } from '@playwright/test';

const PP = `http://localhost:${process.env.PP_PORT ?? '5173'}`;

const workerCode = `
  const c = new OffscreenCanvas(64,64);
  const gl = c.getContext('webgl2');
  if (!gl) { postMessage('no-webgl2'); }
  else {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    postMessage(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
  }
`;

for (const extra of [[], ['--ignore-gpu-blocklist', '--enable-gpu-rasterization']]) {
  const b = await chromium.launch({ headless: false, args: extra });
  const p = await b.newPage();
  await p.goto(`${PP}/flight/`);
  const worker = await p.evaluate(
    (code) =>
      new Promise((res) => {
        const w = new Worker(URL.createObjectURL(new Blob([code])));
        w.onmessage = (e) => res(e.data);
        setTimeout(() => res('timeout'), 5000);
      }),
    workerCode,
  );
  const main = await p.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return 'no-webgl2';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  });
  console.log(JSON.stringify({ extraFlags: extra.length > 0, main, worker }));
  await b.close();
}
