/**
 * BodyArcade Shared World — boot (Checkpoint 01).
 *
 * Views:
 *  - `pool` (the new default): the GAMICO dolphin swims in the unmodified
 *    vendored demo pool mounted at K = 7.5 m/demo-unit, driven by the
 *    ported 120 Hz sim + keyboard/body swim controls.
 *  - `stock`: the pristine vendored jeantimex/threejs-water demo, mounted
 *    exactly as its own src/main.ts does — the untouched Checkpoint-00
 *    water-fidelity reference, byte-identical forever.
 *  - `credits`: the in-app CC-BY attribution panel (mandatory for the
 *    dolphin; mirrors repo-root CREDITS.md).
 */

const params = new URLSearchParams(location.search);
const view = params.get('view') ?? 'pool';

async function mountStock() {
  await import('../vendor/threejs-water/src/styles.css');
  const { WaterApp } = await import('../vendor/threejs-water/src/app/WaterApp');
  void new WaterApp().init();
}

async function mountPool() {
  await import('../vendor/threejs-water/src/styles.css');
  // the stock help panel belongs to the stock demo; the pool view gets a
  // minimal instrument overlay instead
  document.getElementById('help')?.remove();
  document.getElementById('help-toggle')?.remove();
  mountPoolOverlay();

  const { startPoolGame } = await import('./game/game');
  await startPoolGame(document.getElementById('app')!);

  // PosePuppet runtime boot (Master §3.2, per 493dd24:apps/dolphin/src/main.ts):
  // the page owns its tracking pipeline; keyboard play fully survives a
  // denied/absent camera. LITE model — GPU budget goes to the water.
  const { createPoseRuntime } = await import('@bodyarcade/pose-runtime');
  const runtime = createPoseRuntime({
    model: 'lite',
    worker: true,
    captureSize: { width: 640, height: 360 },
    election: 'strict',
    forceExternal: params.get('pp') === 'companion',
  });
  if (params.get('hud') !== '0') {
    const { mountPoseHud } = await import('@bodyarcade/pose-hud');
    const hud = mountPoseHud(runtime, { safeArea: { x: 12, y: 64 }, title: 'SWIM' });
    (window as unknown as { __PP_HUD: typeof hud }).__PP_HUD = hud;
  }
  (window as unknown as { __POSE_RT: typeof runtime }).__POSE_RT = runtime;
  void runtime.start();
}

function mountPoolOverlay() {
  const el = document.createElement('div');
  el.id = 'pool-overlay';
  el.style.cssText =
    'position:fixed;left:12px;top:12px;z-index:10;color:#e8f4fa;' +
    'font:12px/1.7 ui-monospace,Menlo,monospace;text-shadow:0 1px 3px rgba(0,0,0,.6);' +
    'pointer-events:none;user-select:none;';
  el.innerHTML =
    'SHIFT kick · W/S pitch · A/D bank · Q/E trim · SPACE burst · X brake · R recenter<br>' +
    '<a href="?view=credits" style="color:#8fd4ff;pointer-events:auto">credits</a> — ' +
    'dolphin by GAMICO (CC-BY 4.0)';
  document.body.appendChild(el);
}

async function mountCreditsView() {
  const { mountCredits } = await import('./credits');
  document.getElementById('help')?.remove();
  document.getElementById('help-toggle')?.remove();
  document.getElementById('loading')?.remove();
  mountCredits(document.getElementById('app')!);
}

if (view === 'stock') {
  void mountStock();
} else if (view === 'credits') {
  void mountCreditsView();
} else {
  if (view !== 'pool') {
    console.warn(`[shared-world] unknown view "${view}" — mounting pool`);
  }
  void mountPool();
}
