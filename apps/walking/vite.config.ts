import { defineConfig, type Plugin } from 'vite';
import { fileURLToPath } from 'node:url';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';

// Walking graybox builds with base '/walking/' — same-origin convention as
// Flight and Dolphin, so the BroadcastChannel body-signal transport works
// when PosePuppet serves the built app. Pose-runtime model/wasm assets are
// root-absolute (/models, /mediapipe-wasm) by convention; the middleware
// mirrors PosePuppet public/ on this standalone dev server (the Dolphin
// pattern).

const PP_PUBLIC = fileURLToPath(new URL('../../public', import.meta.url));

/** Dev-only: serve /models and /mediapipe-wasm from PosePuppet public/. */
function poseAssets(): Plugin {
  const MIME: Record<string, string> = {
    '.task': 'application/octet-stream',
    '.js': 'text/javascript',
    '.wasm': 'application/wasm',
  };
  return {
    name: 'bodyarcade-pose-assets',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? '').split('?')[0]!;
        if (!url.startsWith('/models/') && !url.startsWith('/mediapipe-wasm/')) return next();
        const file = normalize(join(PP_PUBLIC, decodeURIComponent(url)));
        if (!file.startsWith(resolve(PP_PUBLIC)) || !existsSync(file) || !statSync(file).isFile()) {
          res.statusCode = 404;
          return res.end('not found');
        }
        res.setHeader('Content-Type', MIME[extname(file)] ?? 'application/octet-stream');
        createReadStream(file).pipe(res);
      });
    },
  };
}

export default defineConfig({
  base: '/walking/',
  plugins: [poseAssets()],
  resolve: {
    alias: {
      '@bodyarcade/body-input': fileURLToPath(
        new URL('../../packages/body-input/src/index.ts', import.meta.url),
      ),
      '@bodyarcade/pose-runtime': fileURLToPath(
        new URL('../../packages/pose-runtime/src/index.ts', import.meta.url),
      ),
      '@bodyarcade/pose-hud': fileURLToPath(
        new URL('../../packages/pose-hud/src/index.ts', import.meta.url),
      ),
      '@bodyarcade/locomotion': fileURLToPath(
        new URL('../../packages/locomotion/src/index.ts', import.meta.url),
      ),
    },
  },
  server: {
    port: 5175, // the V3 lane port (prompt-pack table)
    strictPort: false,
    fs: {
      allow: ['..', '../..'],
    },
  },
  build: { outDir: 'dist', target: 'es2022' },
});
