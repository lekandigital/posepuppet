// Motion Memory 2 — browser-level verification against REAL IndexedDB in
// Chromium: v1→v2 migration on seeded v1 records, save→reload byte
// exactness, the storage bound with its eviction prompt, deterministic
// thumbnails through persistence, and the library UI end to end (save →
// card → rename → tape trim → best 5 s → mirror → play → delete → best-
// last-motion grab). Store-level tests run on a page with the app module
// blocked, so the store under test owns the database alone.

import { test, expect, type Page } from '@playwright/test';

declare global {
  interface Window {
    __PP: { videoReady: boolean; detectionCount: number };
  }
}

/** page whose app entry never loads — same origin, dead DOM, live vite */
async function storePage(page: Page): Promise<void> {
  await page.route('**/src/main.ts*', (r) => r.abort());
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
}

/** Seed a v1 database exactly as v1 wrote it: DB version 1, records with
 *  no `v`/avatar/mode/thumbnail fields, Int16Array frames. */
const seedV1 = `
  async function seedV1(loops) {
    const db = await new Promise((res, rej) => {
      const req = indexedDB.open('posepuppet-memory', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('loops', { keyPath: 'id' });
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
    await new Promise((res, rej) => {
      const tx = db.transaction('loops', 'readwrite');
      for (const l of loops) tx.objectStore('loops').put(l);
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
    });
    db.close();
  }
`;

const makeV1Loop = `
  function makeV1Loop(id, name, createdAt, nFrames = 24) {
    const frames = [];
    for (let i = 0; i < nFrames; i++) {
      const q = new Int16Array(33 * 4 + 33 * 3);
      for (let k = 0; k < q.length; k++) q[k] = ((i * 37 + k * 13) % 4001) - 2000;
      frames.push({ t: i * 100, q });
    }
    return { id, name, kind: 'pose', createdAt, durationMs: (nFrames - 1) * 100, frames };
  }
`;

test('migration: real v1 records load through the v2 store, frames byte-identical', async ({ page }) => {
  await storePage(page);
  const result = await page.evaluate(`(async () => {
    ${seedV1}
    ${makeV1Loop}
    const a = makeV1Loop('v1-a', 'old ghost', 1000);
    const b = makeV1Loop('v1-b', 'old wave', 2000);
    const aBytes = a.frames.map((f) => Array.from(f.q));
    await seedV1([a, b]);

    const store = await import('/src/memory/store.ts');
    const metas = await store.listLoops(); // v2 open → in-place migration
    const loopA = await store.loadLoop('v1-a');
    return {
      metaCount: metas.length,
      ids: metas.map((m) => m.id).sort(),
      v: loopA.v,
      avatar: loopA.avatar,
      mode: loopA.mode,
      name: loopA.name,
      createdAt: loopA.createdAt,
      durationMs: loopA.durationMs,
      hasThumb: loopA.thumbSvg.startsWith('<svg'),
      bytes: loopA.bytes,
      framesEqual: loopA.frames.every((f, i) =>
        f.t === i * 100 && Array.from(f.q).every((v, k) => v === aBytes[i][k])),
    };
  })()`);
  expect(result).toMatchObject({
    metaCount: 2,
    ids: ['v1-a', 'v1-b'],
    v: 2,
    avatar: 'unknown',
    mode: 'character',
    name: 'old ghost',
    createdAt: 1000,
    durationMs: 2300,
    hasThumb: true,
    framesEqual: true,
  });
  expect((result as { bytes: number }).bytes).toBeGreaterThan(24 * 462);

  // reopening again is a no-op: still v2, still identical
  const second = await page.evaluate(`(async () => {
    const store = await import('/src/memory/store.ts');
    const l = await store.loadLoop('v1-a');
    return { v: l.v, thumb: l.thumbSvg };
  })()`);
  const first = await page.evaluate(`(async () => {
    const store = await import('/src/memory/store.ts');
    const l = await store.loadLoop('v1-a');
    return l.thumbSvg;
  })()`);
  expect((second as { v: number }).v).toBe(2);
  expect((second as { thumb: string }).thumb).toBe(first);
});

test('save → reload: v2 loop round-trips byte-exactly with its metadata', async ({ page }) => {
  await storePage(page);
  const result = await page.evaluate(`(async () => {
    const stream = await import('/src/memory/stream.ts');
    const store = await import('/src/memory/store.ts');

    // synthetic capture: a small arm-swing so the thumbnail has content
    const person = (t) => {
      const p = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 1 }));
      p[13] = { x: 0.2 + 0.1 * Math.sin(t), y: -0.5, z: 0, visibility: 1 };
      p[15] = { x: 0.25 + 0.2 * Math.sin(t), y: -0.6 - 0.3 * Math.sin(t), z: 0, visibility: 1 };
      p[11] = { x: 0.18, y: -0.5, z: 0, visibility: 1 };
      p[12] = { x: -0.18, y: -0.5, z: 0, visibility: 1 };
      p[23] = { x: 0.1, y: 0, z: 0, visibility: 1 };
      p[24] = { x: -0.1, y: 0, z: 0, visibility: 1 };
      return p;
    };
    const frames = [];
    for (let t = 0; t <= 4000; t += 50) {
      const w = person(t / 1000);
      frames.push(stream.encodePoseFrame(w, w.map((q) => ({ ...q, x: q.x * 0.4 + 0.5 })), t));
    }
    const capture = { id: 'rt-1', name: 'roundtrip', kind: 'pose', createdAt: Date.now(), durationMs: 4000, frames };
    const loop = store.finalizeLoop(capture, 'robot', 'character');
    const srcBytes = loop.frames.map((f) => Array.from(f.q));
    const res = await store.saveLoopBounded(loop, async () => { throw new Error('no eviction expected'); });

    const back = await store.loadLoop('rt-1');
    return {
      saved: res.saved,
      evicted: res.evicted.length,
      v: back.v,
      avatar: back.avatar,
      mode: back.mode,
      thumbSame: back.thumbSvg === loop.thumbSvg,
      framesEqual: back.frames.every((f, i) =>
        f.t === loop.frames[i].t && Array.from(f.q).every((v, k) => v === srcBytes[i][k])),
    };
  })()`);
  expect(result).toMatchObject({
    saved: true,
    evicted: 0,
    v: 2,
    avatar: 'robot',
    mode: 'character',
    thumbSame: true,
    framesEqual: true,
  });
});

test('storage bound: cap triggers the oldest-first eviction prompt; decline saves nothing', async ({ page }) => {
  await storePage(page);
  const result = await page.evaluate(`(async () => {
    const store = await import('/src/memory/store.ts');
    const mk = (id, createdAt) => {
      const frames = [];
      for (let i = 0; i < 12; i++) frames.push({ t: i * 100, q: new Int16Array(231) });
      return store.finalizeLoop(
        { id, name: id, kind: 'pose', createdAt, durationMs: 1100, frames }, 'robot', 'character');
    };
    const caps = { maxBytes: 1024 * 1024, maxLoops: 2 };
    const prompts = [];
    const accept = async (cands) => { prompts.push(cands.map((c) => c.id)); return true; };
    const decline = async (cands) => { prompts.push(cands.map((c) => c.id)); return false; };

    await store.saveLoopBounded(mk('l1', 1000), accept, caps);
    await store.saveLoopBounded(mk('l2', 2000), accept, caps);
    // third save exceeds maxLoops: decline first — nothing changes
    const refused = await store.saveLoopBounded(mk('l3', 3000), decline, caps);
    const afterRefuse = (await store.listLoops()).map((m) => m.id).sort();
    // then accept — the OLDEST (l1) is evicted
    const ok = await store.saveLoopBounded(mk('l3', 3000), accept, caps);
    const afterAccept = (await store.listLoops()).map((m) => m.id).sort();

    // byte cap independently: tiny byte budget forces multi-eviction
    const tiny = { maxBytes: 1, maxLoops: 10 };
    const res2 = await store.saveLoopBounded(mk('l4', 4000), accept, tiny);
    return {
      refusedSaved: refused.saved,
      afterRefuse,
      okSaved: ok.saved,
      okEvicted: ok.evicted.map((e) => e.id),
      afterAccept,
      prompts,
      bigEviction: res2.evicted.length,
    };
  })()`);
  expect(result).toMatchObject({
    refusedSaved: false,
    afterRefuse: ['l1', 'l2'],
    okSaved: true,
    okEvicted: ['l1'],
    afterAccept: ['l2', 'l3'],
  });
  expect((result as { prompts: string[][] }).prompts[0]).toEqual(['l1']);
  expect((result as { bigEviction: number }).bigEviction).toBeGreaterThan(0);
});

test('eviction prompt dialog: lists victims, cancel refuses, evict confirms', async ({ page }) => {
  await storePage(page);
  const cancelled = await page.evaluate(`(async () => {
    const lib = await import('/src/memory/library.ts');
    const p = lib.confirmEvictDialog([
      { id: 'x', name: 'oldest take', kind: 'pose', createdAt: 1, durationMs: 8000, avatar: 'robot', mode: 'character', thumbSvg: '', bytes: 1 },
    ]);
    const dlg = document.querySelector('.mml-evict');
    const text = dlg ? dlg.textContent : '';
    dlg.querySelector('[data-act="cancel"]').click();
    return { text, result: await p, gone: !document.querySelector('.mml-evict') };
  })()`);
  expect((cancelled as { text: string }).text).toContain('oldest take');
  expect((cancelled as { result: boolean }).result).toBe(false);
  expect((cancelled as { gone: boolean }).gone).toBe(true);

  const confirmed = await page.evaluate(`(async () => {
    const lib = await import('/src/memory/library.ts');
    const p = lib.confirmEvictDialog([
      { id: 'x', name: 'a', kind: 'pose', createdAt: 1, durationMs: 1000, avatar: 'robot', mode: 'character', thumbSvg: '', bytes: 1 },
    ]);
    document.querySelector('.mml-evict [data-act="evict"]').click();
    return await p;
  })()`);
  expect(confirmed).toBe(true);
});

test('library UI: save → card → rename → tape trim → mirror → play → delete → best grab', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/');
  await page.waitForFunction(() => window.__PP?.videoReady === true, undefined, { timeout: 20_000 });
  // let the ring buffer fill with ~8 s of tracked motion from the fixture
  await page.waitForFunction(() => window.__PP.detectionCount > 30, undefined, { timeout: 45_000 });
  await page.waitForTimeout(8_500);

  // save the last 8 s through the command palette
  await page.keyboard.press('ControlOrMeta+k');
  await page.fill('.palette-input', 'save last');
  await page.keyboard.press('Enter');
  // (the coach line is shared with the perf tuner under SwiftShader — the
  // card appearing in the library is the real save signal)

  // open the library with its shortcut: one card, thumbnail, metadata
  await page.keyboard.press('l');
  const library = page.locator('#library');
  await expect(library).toBeVisible();
  const card = library.locator('.mml-card');
  await expect(card).toHaveCount(1, { timeout: 15_000 });
  await expect(card.locator('.mml-thumb svg')).toBeVisible();
  // duration · avatar-at-capture · mode · date
  await expect(card.locator('.mml-meta')).toHaveText(/^\d+\.\ds · \w+ · character · \w{3} \d+$/);
  await expect(library.locator('#mml-totals')).toContainText('1 loop');

  // rename persists across close/reopen
  await card.locator('.mml-name').fill('wave take');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await page.keyboard.press('l');
  await expect(library.locator('.mml-card .mml-name')).toHaveValue('wave take', { timeout: 10_000 });

  // motion tape: editor opens with the energy strip; best-5s snaps the
  // handles; apply rewrites the loop to the kept window
  await library.locator('.mml-card button', { hasText: 'tape' }).click();
  const editor = library.locator('#mml-editor');
  await expect(editor).toBeVisible();
  await expect(library.locator('#mml-tape')).toBeVisible();
  const readBefore = (await library.locator('#mml-ed-read').textContent()) ?? '';
  expect(readBefore).toContain('keeps');

  await library.locator('#mml-best').click();
  const readBest = (await library.locator('#mml-ed-read').textContent()) ?? '';
  const keeps = Number(/keeps (\d+(?:\.\d+)?)s/.exec(readBest)?.[1]);
  expect(keeps).toBeGreaterThan(0.4);
  expect(keeps).toBeLessThanOrEqual(5.1);

  // drag the in-handle along the tape — scrub-to-trim moves the window
  const tape = library.locator('#mml-tape');
  const box = (await tape.boundingBox())!;
  await page.mouse.move(box.x + 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.1, box.y + box.height / 2, { steps: 4 });
  await page.mouse.up();
  const readDragged = (await library.locator('#mml-ed-read').textContent()) ?? '';
  expect(readDragged).not.toBe(readBest);

  await library.locator('#mml-best').click(); // snap back to the best window
  await library.locator('#mml-apply').click();
  await expect(library.locator('.mml-card .mml-meta')).toContainText(`${keeps.toFixed(1)}s`, { timeout: 10_000 });

  // mirror toggle + duet playback drives the ghost pipeline
  await library.locator('#mml-mirror').click();
  await expect(library.locator('#mml-mirror')).toHaveAttribute('aria-pressed', 'true');
  await library.locator('.mml-card .mml-btn.play').click();
  await expect(page.locator('#ghost-btn')).toHaveClass(/on/, { timeout: 15_000 });

  // stop the duet ghost (it costs real render+detection Hz under
  // SwiftShader, which makes every later click sluggish) — the library is
  // modal, so drop out of it first
  await page.keyboard.press('Escape');
  await page.click('#ghost-btn');
  await expect(page.locator('#ghost-btn')).not.toHaveClass(/on/);
  await page.keyboard.press('l');
  await expect(library).toBeVisible();

  // delete: two-click confirm on the same button, then the empty state
  // returns (the confirm click is dispatched directly — the first click
  // already proved hit-testability, and the arm window is finite)
  const del = library.locator('.mml-card-row button').nth(2);
  await del.click();
  await expect(del).toHaveText('sure?');
  await del.dispatchEvent('click');
  await expect(library.locator('.mml-card')).toHaveCount(0, { timeout: 10_000 });
  await expect(library.locator('.mml-empty')).toBeVisible();
  await page.keyboard.press('Escape');

  // let the ring refill with fresh tracked frames before the best grab
  const countBefore = await page.evaluate(() => window.__PP.detectionCount);
  await page.waitForFunction(
    (n) => window.__PP.detectionCount > n + 10,
    countBefore,
    { timeout: 45_000 },
  );

  // best-last-motion grab from the rail: a ~5 s "best" loop lands in the library
  await page.click('#best-btn');
  await page.keyboard.press('l');
  await expect(library.locator('.mml-card')).toHaveCount(1, { timeout: 15_000 });
  await expect(library.locator('.mml-card .mml-name')).toHaveValue(/best/, { timeout: 10_000 });
});
