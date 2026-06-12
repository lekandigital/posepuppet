import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';

// Serve the consolidated attempts models folder so we don't copy 7+ GB
const consolidatedModelsPath = resolve(
  process.env.HOME || '',
  'Downloads/PosePuppet_Consolidated_Attempts_20260611-204228/models',
);

export default defineConfig({
  server: {
    port: 5173,
    strictPort: true,
    fs: {
      allow: [
        '.',
        // Allow Vite to serve from the consolidated models folder
        ...(existsSync(consolidatedModelsPath) ? [consolidatedModelsPath] : []),
      ],
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        'vrm-viewer': resolve(__dirname, 'vrm-viewer.html'),
      },
    },
  },
});
