// Dedicated headed BodyArcade shared-world review launcher.
//
// Opens one persistent Google Chrome window with one tab at the requested
// view URL. Uses a local user-data directory and a localhost control endpoint
// so the Chrome profile persists and secondary invocations attach seamlessly.
// The browser stays open for interactive review; press Ctrl-C to close.
//
// Usage:
//   node apps/shared-world/review.mjs                         # pool (default)
//   node apps/shared-world/review.mjs --view=region           # region game view
//   node apps/shared-world/review.mjs --view=region-preview   # graybox terrain
//   node apps/shared-world/review.mjs --display=secondary     # rotated side monitor
//   node apps/shared-world/review.mjs --display=builtin       # built-in display
//   node apps/shared-world/review.mjs --url=/shared-world/?view=pool&debug=1

import { chromium } from '@playwright/test';
import { spawn, spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, readFileSync, writeFileSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { createServer, request } from 'node:http';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const GAME_PORT = process.env.SHARED_WORLD_PORT ?? '5198';
const BASE = `http://localhost:${GAME_PORT}`;

// --- CLI ---
const argv = process.argv.slice(2);
const displayArg = (argv.find((a) => a.startsWith('--display=')) ?? '--display=secondary').split('=')[1];
const viewArg = (argv.find((a) => a.startsWith('--view=')) ?? '--view=pool').split('=')[1];
const urlArg = argv.find((a) => a.startsWith('--url='))?.split('=').slice(1).join('=');
const reviewUrl = urlArg
  ? `${BASE}${urlArg.startsWith('/') ? '' : '/'}${urlArg}`
  : `${BASE}/shared-world/?view=${viewArg}`;

const DISPLAY_PRESETS = {
  builtin: {
    name: 'builtin',
    label: 'built-in display',
    viewport: { width: 1728, height: 1080 },
    args: ['--window-position=0,0'],
    windowPlacement: { left: 0, top: 0, right: 1728, bottom: 1080 },
    chromeBounds: null,
  },
  secondary: {
    name: 'secondary',
    label: 'secondary display',
    viewport: { width: 1365, height: 768 },
    args: [
      // Chrome/macOS lands this review window 31 px lower than the launch
      // request on the rotated monitor, so the launch target is compensated
      // to resolve to the measured outer bounds below.
      '--window-position=153,-2591',
      '--window-size=1440,853',
    ],
    windowPlacement: { left: 153, top: -2560, right: 1593, bottom: -1707 },
    chromeBounds: { left: 153, top: -2560, right: 1593, bottom: -1707 },
  },
};

const display = DISPLAY_PRESETS[displayArg] ?? DISPLAY_PRESETS.secondary;
if (!DISPLAY_PRESETS[displayArg]) {
  console.warn(`[ReviewLauncher] Unknown --display=${displayArg}; defaulting to secondary.`);
}

// --- User-data directory & Singleton Control ---
const USER_DATA_DIR = resolve(ROOT, '.local', 'chrome-review-profile');
mkdirSync(USER_DATA_DIR, { recursive: true });
const ENDPOINT_FILE = resolve(USER_DATA_DIR, 'endpoint.json');

function resetChromeProfileState() {
  rmSync(USER_DATA_DIR, { recursive: true, force: true });
  mkdirSync(USER_DATA_DIR, { recursive: true });
}

function seedChromeWindowPlacement() {
  if (!display.windowPlacement) return;
  const preferencesFile = resolve(USER_DATA_DIR, 'Default', 'Preferences');
  try {
    if (existsSync(preferencesFile)) {
      const prefs = JSON.parse(readFileSync(preferencesFile, 'utf8'));
      prefs.browser ??= {};
      prefs.browser.window_placement = {
        ...display.windowPlacement,
        maximized: false,
        work_area_left: display.windowPlacement.left,
        work_area_top: display.windowPlacement.top,
        work_area_right: display.windowPlacement.right,
        work_area_bottom: display.windowPlacement.bottom,
      };
      writeFileSync(preferencesFile, `${JSON.stringify(prefs)}`);
    }
  } catch (err) {
    console.warn(`[ReviewLauncher] Failed to seed Chrome window placement prefs: ${err?.message ?? err}`);
  }
}

// Attempt cross-invocation reuse if an owner process is already running.
if (existsSync(ENDPOINT_FILE)) {
  try {
    const { port } = JSON.parse(readFileSync(ENDPOINT_FILE, 'utf8'));
    const success = await new Promise((res) => {
      const req = request(
        { hostname: '127.0.0.1', port, path: '/navigate', method: 'POST', timeout: 2000 },
        (response) => res(response.statusCode === 200)
      );
      req.on('error', () => res(false));
      req.on('timeout', () => { req.destroy(); res(false); });
      req.write(JSON.stringify({ url: reviewUrl }));
      req.end();
    });
    if (success) {
      console.log(`Directed existing review window to ${reviewUrl}`);
      process.exit(0);
    } else {
      console.log('Stale lock detected. Taking ownership of the review process.');
      rmSync(ENDPOINT_FILE, { force: true });
    }
  } catch (err) {
    console.log('Failed to parse stale lock. Taking ownership.');
    rmSync(ENDPOINT_FILE, { force: true });
  }
}

resetChromeProfileState();
seedChromeWindowPlacement();

// --- Dev server ---
async function serverUp() {
  try {
    await fetch(BASE);
    return true;
  } catch {
    return false;
  }
}

let devServer = null;
if (!(await serverUp())) {
  console.log(`starting shared-world dev server on port ${GAME_PORT}…`);
  devServer = spawn(
    'npm', ['run', 'dev', '--', '--port', GAME_PORT, '--strictPort'],
    { cwd: HERE, stdio: 'ignore', detached: true },
  );
  for (let i = 0; i < 60 && !(await serverUp()); i++) {
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!(await serverUp())) {
    console.error('dev server failed to start');
    process.exit(1);
  }
}

// --- One persistent Chrome window, one tab ---
const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
  channel: 'chrome',
  headless: false,
  viewport: display.viewport,
  args: [
    '--deny-permission-prompts', // Defense in depth
    '--disable-backgrounding-occluded-windows',
    ...display.args,
  ],
  permissions: [],
});

// Deterministic camera mock before any app code runs.
await context.addInitScript(() => {
  window.__mockedCameraAttempted = false;
  if (navigator.mediaDevices) {
    const originalGetUserMedia = navigator.mediaDevices.getUserMedia;
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      window.__mockedCameraAttempted = true;
      console.log('[ReviewLauncher] Mocked getUserMedia invoked.');
      return Promise.reject(new DOMException('Permission denied by automated review launcher', 'NotAllowedError'));
    };
  }
});

// Enforce exactly one tab
const pages = context.pages();
const page = pages.length > 0 ? pages[0] : await context.newPage();
for (const p of context.pages()) {
  if (p !== page) await p.close();
}

console.log(`navigating to ${reviewUrl}`);
await page.goto(reviewUrl);

if (display.chromeBounds) {
  await page.bringToFront().catch(() => {});
  await new Promise((resolve) => setTimeout(resolve, 300));

  const boundsScript = `tell application "Google Chrome"
    if (count of windows) = 0 then
      return "no-window"
    end if
    set bounds of front window to {${display.chromeBounds.left}, ${display.chromeBounds.top}, ${display.chromeBounds.right}, ${display.chromeBounds.bottom}}
    return bounds of front window
  end tell`;
  const placement = spawnSync('osascript', ['-e', boundsScript], { encoding: 'utf8' });
  const expectedBounds = `{${display.chromeBounds.left}, ${display.chromeBounds.top}, ${display.chromeBounds.right}, ${display.chromeBounds.bottom}}`;
  let appleScriptMatched = false;
  if (placement.status !== 0) {
    console.warn(`[ReviewLauncher] AppleScript placement failed: ${placement.stderr.trim() || placement.stdout.trim() || `exit ${placement.status}`}`);
  } else {
    const actualBounds = placement.stdout.trim().replace(/\s+/g, ' ');
    if (actualBounds === expectedBounds) {
      appleScriptMatched = true;
      console.log(`[ReviewLauncher] AppleScript confirmed Chrome bounds: ${actualBounds}`);
    } else {
      console.warn(`[ReviewLauncher] AppleScript returned unexpected bounds (${actualBounds || 'empty'}), expected ${expectedBounds}.`);
    }
  }

  if (!appleScriptMatched) {
    try {
      const cdp = await context.newCDPSession(page);
      const width = display.chromeBounds.right - display.chromeBounds.left;
      const height = display.chromeBounds.bottom - display.chromeBounds.top;
      const { windowId } = await cdp.send('Browser.getWindowForTarget');
      await cdp.send('Browser.setWindowBounds', {
        windowId,
        bounds: {
          left: display.chromeBounds.left,
          top: display.chromeBounds.top,
          width,
          height,
        },
      });
      const { bounds } = await cdp.send('Browser.getWindowBounds', { windowId });
      const cdpActual = `{${bounds.left}, ${bounds.top}, ${bounds.left + bounds.width}, ${bounds.top + bounds.height}}`;
      if (cdpActual === expectedBounds) {
        console.log(`[ReviewLauncher] Chrome DevTools fallback confirmed Chrome bounds: ${cdpActual}`);
      } else {
        console.warn(`[ReviewLauncher] Chrome DevTools fallback bounds mismatch (${cdpActual || 'empty'}), expected ${expectedBounds}.`);
      }
    } catch (err) {
      console.warn(`[ReviewLauncher] Chrome DevTools window placement fallback failed: ${err?.message ?? err}`);
    }
  }
}

// --- Singleton Control Server (Owner) ---
const server = createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/navigate') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { url } = JSON.parse(body);
        console.log(`[Control] Navigating existing tab to ${url}`);

        // Respond immediately so the secondary process can exit
        res.writeHead(200);
        res.end();

        // Enforce exactly one tab again just in case popups occurred
        for (const p of context.pages()) {
          if (p !== page) await p.close();
        }
        await page.goto(url).catch(() => {});
      } catch (err) {
        if (!res.headersSent) {
          res.writeHead(500);
          res.end();
        }
      }
    });
  } else {
    res.writeHead(404);
    res.end();
  }
});

await new Promise((resolve) => {
  server.listen(0, '127.0.0.1', () => {
    const port = server.address().port;
    writeFileSync(ENDPOINT_FILE, JSON.stringify({ port }));
    resolve();
  });
});

// Report verifications
const vp = page.viewportSize();
console.log(`viewport: ${vp?.width}×${vp?.height}`);
console.log(`display: ${display.name} (${display.label})`);
console.log(`window position: ${display.args.find((arg) => arg.startsWith('--window-position=')) ?? 'n/a'}`);
console.log(`window size: ${display.args.find((arg) => arg.startsWith('--window-size=')) ?? 'n/a'}`);
console.log(`camera mock: installed (blocks native capture)`);
console.log(`Chrome channel: chrome`);
console.log(`owner control port: ${server.address().port}`);

// Periodic verification of camera mock
setInterval(async () => {
  try {
    const attempted = await page.evaluate('window.__mockedCameraAttempted');
    if (attempted && !global.__loggedCameraMock) {
      console.log('✅ Verified: Application correctly hit the mocked getUserMedia; native capture was never reached.');
      global.__loggedCameraMock = true;
    }
  } catch (err) {}
}, 2000);

console.log(`\nReview is live. Press Ctrl-C to close.\n`);

// Clean shutdown
await new Promise((resolve) => {
  context.on('close', resolve);
  process.on('SIGINT', resolve);
});

console.log('\nclosing…');
rmSync(ENDPOINT_FILE, { force: true });
server.close();
await context.close().catch(() => {});
if (devServer) {
  try { process.kill(-devServer.pid, 'SIGTERM'); } catch {}
}
process.exit(0);
