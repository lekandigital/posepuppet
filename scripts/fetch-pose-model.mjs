// Downloads the MediaPipe pose landmarker models (Apache-2.0, Google) into
// public/models/ at install time so the running app never touches the network.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'public', 'models');
mkdirSync(dir, { recursive: true });

const BASE = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker';
const HAND_BASE = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker';
const SEG_BASE = 'https://storage.googleapis.com/mediapipe-models/image_segmenter';
const MODELS = [
  ['pose_landmarker_full.task', `${BASE}/pose_landmarker_full/float16/latest/pose_landmarker_full.task`],
  ['pose_landmarker_lite.task', `${BASE}/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task`],
  // hand-only mode (pass 2 P3): 21-landmark hand tracking, same Apache-2.0
  // Google family as the pose models — recorded in ASSETS.md
  ['hand_landmarker.task', `${HAND_BASE}/hand_landmarker/float16/latest/hand_landmarker.task`],
  // recording presentation layer (V7): local person segmentation — same
  // Apache-2.0 Google MediaPipe family, recorded in ASSETS.md
  ['selfie_segmenter.tflite', `${SEG_BASE}/selfie_segmenter/float16/latest/selfie_segmenter.tflite`],
  ['selfie_segmenter_landscape.tflite', `${SEG_BASE}/selfie_segmenter_landscape/float16/latest/selfie_segmenter_landscape.tflite`],
];

for (const [name, url] of MODELS) {
  const dest = join(dir, name);
  if (existsSync(dest)) {
    console.log(`fetch-pose-model: ${name} present`);
    continue;
  }
  console.log(`fetch-pose-model: downloading ${name}…`);
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`fetch-pose-model: ${url} → HTTP ${res.status}`);
    process.exit(1);
  }
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  console.log(`fetch-pose-model: saved ${name}`);
}
