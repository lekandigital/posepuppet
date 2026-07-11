import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// BodyArcade Dolphin builds with base '/dolphin/' — PosePuppet's dev server
// serves the built app there (same ORIGIN as the producer, so the
// BroadcastChannel body-signal transport works; the Gate-2 lesson from
// Flight). All assets stay under the base — no root-absolute prefixes.
export default defineConfig({
  base: '/dolphin/',
  resolve: {
    alias: {
      '@bodyarcade/body-input': fileURLToPath(
        new URL('../../packages/body-input/src/index.ts', import.meta.url),
      ),
      '@bodyarcade/world-data': fileURLToPath(
        new URL('../../packages/world-data/src/index.ts', import.meta.url),
      ),
    },
  },
  server: { port: 5197, strictPort: false },
  build: { outDir: 'dist', target: 'es2022' },
});
