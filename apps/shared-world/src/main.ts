/**
 * BodyArcade Shared World — boot (Checkpoint 00).
 *
 * Reads `?view=`; the only view at this checkpoint is `stock` (the default):
 * the pristine vendored jeantimex/threejs-water demo, mounted exactly as its
 * own src/main.ts does (styles import + `new WaterApp().init()`). It stays
 * reachable at `?view=stock` forever as the water-fidelity reference.
 */

const view = new URLSearchParams(location.search).get('view') ?? 'stock';

async function mountStock() {
  await import('../vendor/threejs-water/src/styles.css');
  const { WaterApp } = await import('../vendor/threejs-water/src/app/WaterApp');
  void new WaterApp().init();
}

if (view !== 'stock') {
  console.warn(`[shared-world] unknown view "${view}" — mounting stock demo`);
}
void mountStock();
