// Copies the @mediapipe/tasks-vision wasm runtime out of node_modules into
// public/ so the app serves everything from the local origin (no CDN).
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const dest = join(root, 'public', 'mediapipe-wasm');

if (!existsSync(src)) {
  console.error('copy-mediapipe-wasm: @mediapipe/tasks-vision not installed yet, skipping');
  process.exit(0);
}
mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
console.log('copy-mediapipe-wasm: copied wasm runtime to public/mediapipe-wasm');
