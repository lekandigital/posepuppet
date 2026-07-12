import { defineConfig, type Plugin } from 'vite';
import { fileURLToPath } from 'node:url';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';

const FLIGHT_DIST = fileURLToPath(new URL('./apps/flight/client/dist', import.meta.url));
const DOLPHIN_DIST = fileURLToPath(new URL('./apps/dolphin/dist', import.meta.url));

/**
 * BodyArcade Flight is a separate app (own three.js, own build) but must
 * share PosePuppet's ORIGIN so BroadcastChannel body signals reach it —
 * BroadcastChannel is origin-scoped and two dev-server ports are two
 * origins (the Gate-2 failure). This plugin serves the built flight app:
 *   /flight/            → apps/flight/client/dist (base: '/flight/')
 *   /audio /3D /2D /npc /fonts /social-card.png
 *                       → same dist (the game fetches these root-absolute)
 * The prefixes are disjoint from PosePuppet's own public/ (verified).
 * Build it with `npm run arcade` (one command: build flight + start here).
 */
/**
 * BodyArcade Dolphin: same origin-sharing pattern as flightStatic, one
 * route prefix only (the dolphin keeps every asset under its base).
 *   /dolphin/ → apps/dolphin/dist (base: '/dolphin/')
 */
function dolphinStatic(): Plugin {
  const MIME: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
  };
  return {
    name: 'bodyarcade-dolphin-static',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? '').split('?')[0]!;
        let rel: string | null = null;
        if (url === '/dolphin' || url === '/dolphin/') rel = 'index.html';
        else if (url.startsWith('/dolphin/')) rel = url.slice('/dolphin/'.length);
        if (rel === null) return next();
        const file = normalize(join(DOLPHIN_DIST, decodeURIComponent(rel)));
        if (!file.startsWith(resolve(DOLPHIN_DIST))) {
          res.statusCode = 403;
          return res.end('forbidden');
        }
        if (!existsSync(file) || !statSync(file).isFile()) {
          if (!existsSync(DOLPHIN_DIST)) {
            res.statusCode = 503;
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            return res.end(
              'BodyArcade Dolphin is not built yet.\n\nRun:  npm run dolphin:build\n',
            );
          }
          res.statusCode = 404;
          return res.end('not found');
        }
        res.setHeader('Content-Type', MIME[extname(file)] ?? 'application/octet-stream');
        createReadStream(file).pipe(res);
      });
    },
  };
}

function flightStatic(): Plugin {
  const MIME: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.mp3': 'audio/mpeg',
    '.glb': 'model/gltf-binary',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ttf': 'font/ttf',
    '.woff2': 'font/woff2',
    '.ico': 'image/x-icon',
    '.webmanifest': 'application/manifest+json',
  };
  const ASSET_PREFIXES = ['/audio/', '/3D/', '/2D/', '/npc/', '/fonts/'];

  return {
    name: 'bodyarcade-flight-static',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? '').split('?')[0]!;
        let rel: string | null = null;
        if (url === '/flight' || url === '/flight/') rel = 'index.html';
        else if (url.startsWith('/flight/')) rel = url.slice('/flight/'.length);
        else if (url === '/social-card.png') rel = 'social-card.png';
        else if (ASSET_PREFIXES.some((p) => url.startsWith(p))) rel = url.slice(1);
        if (rel === null) return next();

        const file = normalize(join(FLIGHT_DIST, decodeURIComponent(rel)));
        if (!file.startsWith(resolve(FLIGHT_DIST))) {
          res.statusCode = 403;
          return res.end('forbidden');
        }
        if (!existsSync(FLIGHT_DIST)) {
          res.statusCode = 503;
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          return res.end(
            'BodyArcade Flight is not built yet.\n\n' +
              'Run:  npm run arcade\n' +
              '(or:  npm --prefix apps/flight run build:client)\n',
          );
        }
        const target =
          existsSync(file) && statSync(file).isFile()
            ? file
            : url.startsWith('/flight/')
              ? join(FLIGHT_DIST, 'index.html') // SPA fallback inside /flight/
              : null;
        if (!target || !existsSync(target)) return next();
        res.setHeader('Content-Type', MIME[extname(target)] ?? 'application/octet-stream');
        createReadStream(target).pipe(res);
      });
    },
  };
}

export default defineConfig({
  plugins: [flightStatic(), dolphinStatic()],
  resolve: {
    alias: {
      '@bodyarcade/body-input': fileURLToPath(
        new URL('./packages/body-input/src/index.ts', import.meta.url),
      ),
      '@bodyarcade/pose-runtime': fileURLToPath(
        new URL('./packages/pose-runtime/src/index.ts', import.meta.url),
      ),
      '@bodyarcade/pose-hud': fileURLToPath(
        new URL('./packages/pose-hud/src/index.ts', import.meta.url),
      ),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    fs: { allow: ['.'] },
  },
});
