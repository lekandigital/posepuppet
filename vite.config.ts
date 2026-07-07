import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@bodyarcade/body-input': fileURLToPath(
        new URL('./packages/body-input/src/index.ts', import.meta.url),
      ),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    fs: { allow: ['.'] },
  },
});
