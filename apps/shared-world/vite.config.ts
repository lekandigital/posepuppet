import { defineConfig, type Plugin } from 'vite';
import glsl from 'vite-plugin-glsl';
import { fileURLToPath } from 'node:url';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';

// BodyArcade Shared World builds with base '/shared-world/' — PosePuppet's
// dev server serves the built app there (same ORIGIN as the producer, so the
// BroadcastChannel body-signal transport works; the Gate-2 lesson from
// Flight). All assets stay under the base — no root-absolute prefixes,
// EXCEPT the pose-runtime model/wasm assets, which are root-absolute by
// convention (/models, /mediapipe-wasm): the production topology serves
// them from PosePuppet public/ on the shared origin, and the middleware
// below mirrors that on this standalone dev server.
//
// publicDir points at the pristine vendored demo's public/ so the stock
// jeantimex assets (sky cubemap, tiles, duck) serve under the base exactly
// as upstream expects via import.meta.env.BASE_URL. The vendored tree at
// vendor/threejs-water/ is byte-identical to upstream and never edited.

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
  base: '/shared-world/',
  publicDir: 'vendor/threejs-water/public',
  plugins: [glsl(), poseAssets()],
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
    },
  },
  server: {
    port: 5198,
    strictPort: true,
    fs: {
      // let vite serve package source from outside apps/shared-world
      allow: ['..', '../..'],
    },
  },
  build: { outDir: 'dist', target: 'es2022' },
});
