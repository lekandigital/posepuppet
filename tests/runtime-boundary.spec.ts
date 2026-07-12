// The privacy boundary, unit-level: BodySignal (the only thing transports
// carry) contains no landmark-shaped payload anywhere in its object graph,
// and PreviewFrame (the approved HUD render state) is quantized 2D with no
// depth and no raw visibility floats. Pure node — no browser.
import { test, expect } from '@playwright/test';
import {
  createBodyInputCore,
  createInPageChannel,
  assertSignalShape,
  type BodySignal,
} from '../packages/body-input/src/index';
import {
  buildPreviewFrame,
  createPreviewFrame,
  PREVIEW_HIDDEN,
  PREVIEW_Q,
} from '../packages/pose-runtime/src/preview';
import type { LandmarkPoint } from '../packages/pose-runtime/src/types';

function lm(x: number, y: number, z: number, visibility = 1): LandmarkPoint {
  return { x, y, z, visibility };
}

function person(t: number): { world: LandmarkPoint[]; norm: LandmarkPoint[] } {
  const world = Array.from({ length: 33 }, (_, i) =>
    lm(Math.sin(t / 300 + i) * 0.3, -0.5 + i * 0.02, Math.cos(t / 500 + i) * 0.1),
  );
  const norm = Array.from({ length: 33 }, (_, i) =>
    lm(0.5 + Math.sin(t / 300 + i) * 0.2, 0.3 + i * 0.015, 0),
  );
  return { world, norm };
}

/** True if any array in the graph looks like a landmark set: ≥ 21 entries
 *  that are objects carrying numeric x/y/z. */
function containsLandmarkArray(v: unknown, seen = new Set<unknown>()): boolean {
  if (v === null || typeof v !== 'object' || seen.has(v)) return false;
  seen.add(v);
  if (Array.isArray(v)) {
    if (v.length >= 21) {
      const pointy = v.filter(
        (e) =>
          e !== null &&
          typeof e === 'object' &&
          typeof (e as { x?: unknown }).x === 'number' &&
          typeof (e as { y?: unknown }).y === 'number' &&
          typeof (e as { z?: unknown }).z === 'number',
      );
      if (pointy.length > v.length / 2) return true;
    }
    return v.some((e) => containsLandmarkArray(e, seen));
  }
  return Object.values(v).some((e) => containsLandmarkArray(e, seen));
}

test('landmark arrays are detected by the scanner (sanity)', () => {
  const { world } = person(0);
  expect(containsLandmarkArray({ deep: { list: world } })).toBe(true);
  expect(containsLandmarkArray({ axes: { leanX: 0.2 }, events: [] })).toBe(false);
});

test('every emitted BodySignal is schema-shaped and landmark-free', () => {
  const core = createBodyInputCore();
  const { source, sink } = createInPageChannel();
  const wire: BodySignal[] = [];
  source.subscribe((s) => wire.push(JSON.parse(JSON.stringify(s))));

  for (let i = 0; i < 60; i++) {
    const t = i * 33;
    const { world, norm } = person(t);
    const signal = core.push({ tsMs: t, world, norm });
    sink.publish(signal);
  }
  // a couple of dropout frames too — the decayed signal is also clean
  for (let i = 60; i < 70; i++) {
    sink.publish(core.push({ tsMs: i * 33, world: null, norm: null }));
  }

  expect(wire.length).toBeGreaterThan(50);
  for (const s of wire) {
    assertSignalShape(s);
    expect(containsLandmarkArray(s)).toBe(false);
  }
});

test('PreviewFrame is quantized 2D render state — no depth, no raw floats', () => {
  const out = createPreviewFrame();
  const { norm } = person(400);
  norm[20].visibility = 0.1; // hidden point → sentinel
  buildPreviewFrame(out, norm, 400, { leftArm: 'PREDICTED' }, 0.876543, true);

  expect(out.pts).toBeInstanceOf(Int16Array);
  expect(out.pts.length).toBe(66);
  for (const q of out.pts) {
    expect(Number.isInteger(q)).toBe(true);
    expect(q).toBeGreaterThanOrEqual(PREVIEW_HIDDEN);
    expect(q).toBeLessThanOrEqual(PREVIEW_Q);
  }
  expect(out.pts[40]).toBe(PREVIEW_HIDDEN); // index 20 x
  expect(out.confidence).toBe(0.88); // coarse, 2 decimals
  expect(containsLandmarkArray(out)).toBe(false);
  // no z channel exists anywhere on the type
  expect('z' in out).toBe(false);

  // cleared on tracking loss
  buildPreviewFrame(out, null, 500, {}, 0, false);
  expect(Array.from(out.pts).every((q) => q === PREVIEW_HIDDEN)).toBe(true);
});
