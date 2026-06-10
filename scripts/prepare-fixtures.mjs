// Converts fixtures/*.mp4 to .y4m for Chrome's --use-file-for-fake-video-capture.
// Downscaled to 720p / 30fps: raw 1080p60 y4m would be ~2GB per clip.
import { execFileSync } from 'node:child_process';
import { readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'fixtures');

if (!existsSync(dir)) {
  console.error('fixtures/ missing — record arms.mp4, torso.mp4, fast.mp4 first');
  process.exit(1);
}

const clips = readdirSync(dir).filter((f) => f.endsWith('.mp4'));
if (clips.length === 0) {
  console.error('no .mp4 clips in fixtures/');
  process.exit(1);
}

for (const clip of clips) {
  const src = join(dir, clip);
  const dest = join(dir, basename(clip, '.mp4') + '.y4m');
  if (existsSync(dest) && statSync(dest).mtimeMs > statSync(src).mtimeMs) {
    console.log(`up to date: ${dest}`);
    continue;
  }
  console.log(`converting ${clip} → ${basename(dest)}`);
  execFileSync('ffmpeg', [
    '-y', '-i', src,
    '-vf', 'scale=-2:720,fps=30',
    '-pix_fmt', 'yuv420p',
    dest,
  ], { stdio: ['ignore', 'ignore', 'inherit'] });
  const mb = (statSync(dest).size / 1e6).toFixed(0);
  console.log(`  ${mb} MB`);
}
