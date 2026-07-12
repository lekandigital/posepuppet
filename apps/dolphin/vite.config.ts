import { defineConfig, type Plugin } from 'vite';
import { fileURLToPath } from 'node:url';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';

// BodyArcade Dolphin builds with base '/dolphin/' — PosePuppet's dev server
// serves the built app there (same ORIGIN as the producer, so the
// BroadcastChannel body-signal transport works; the Gate-2 lesson from
// Flight). All assets stay under the base — no root-absolute prefixes,
// EXCEPT the pose-runtime model/wasm assets, which are root-absolute by
// convention (/models, /mediapipe-wasm): the production topology serves
// them from PosePuppet public/ on the shared origin, and the middleware
// below mirrors that on this standalone dev server.

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
  base: '/dolphin/',
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
      '@bodyarcade/world-data': fileURLToPath(
        new URL('../../packages/world-data/src/index.ts', import.meta.url),
      ),
    },
  },
  server: {
    port: 5197,
    strictPort: false,
    fs: {
      // let vite serve package source from outside apps/dolphin
      allow: ['..', '../..'],
    },
  },
  build: { outDir: 'dist', target: 'es2022' },
});
