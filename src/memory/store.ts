// Motion Memory persistence: named loops in IndexedDB. Fully local —
// structured clone stores the Int16Arrays natively, no serialization
// ceremony, nothing ever leaves the machine.
//
// Schema v2 (see docs/MOTION_MEMORY.md): DB version 2. v1 records (no `v`
// field) are migrated in place inside onupgradeneeded — ids, names,
// timestamps and frame bytes untouched; the new fields (avatar, mode,
// thumbnail, byte accounting) are synthesized. Storage is bounded: a
// total-bytes cap and a loop-count cap, enforced at save time with an
// explicit oldest-first eviction prompt — the store never silently
// deletes and never silently grows without bound.

import type { LoopCapture, LoopMode, MotionLoop } from './stream';
import { loopThumbnail } from './thumbnail';

const DB_NAME = 'posepuppet-memory';
const STORE = 'loops';
const DB_VERSION = 2;

export interface StorageCaps {
  maxBytes: number;
  maxLoops: number;
}

/** ~64 eight-second pose loops before the eviction prompt appears. */
export const DEFAULT_CAPS: StorageCaps = { maxBytes: 32 * 1024 * 1024, maxLoops: 64 };

/** Storage accounting for one loop: frame buffers + per-frame overhead +
 *  thumbnail string + fixed record overhead. An estimate, but a stable,
 *  monotone one — good enough to bound the store. */
export function loopBytes(loop: Pick<MotionLoop, 'frames' | 'thumbSvg'>): number {
  let b = 256 + loop.thumbSvg.length * 2;
  for (const f of loop.frames) b += f.q.byteLength + 16;
  return b;
}

/** Promote a ring-buffer capture to a persisted v2 loop. */
export function finalizeLoop(capture: LoopCapture, avatar: string, mode: LoopMode): MotionLoop {
  const thumbSvg = loopThumbnail(capture);
  const loop: MotionLoop = { ...capture, v: 2, avatar, mode, thumbSvg, bytes: 0 };
  loop.bytes = loopBytes(loop);
  return loop;
}

/** v1 record → v2, synthesizing the fields v1 never had. Exported for the
 *  migration spec. */
export function migrateRecord(rec: LoopCapture & Partial<MotionLoop>): MotionLoop {
  if (rec.v === 2) return rec as MotionLoop;
  return finalizeLoop(rec, 'unknown', rec.kind === 'hand' ? 'hand' : 'character');
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (ev) => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
        return;
      }
      if (ev.oldVersion === 1) {
        // migrate v1 records in place, inside the upgrade transaction
        const store = req.transaction!.objectStore(STORE);
        const cur = store.openCursor();
        cur.onsuccess = () => {
          const c = cur.result;
          if (!c) return;
          const rec = c.value as LoopCapture & Partial<MotionLoop>;
          if (rec.v !== 2) c.update(migrateRecord(rec));
          c.continue();
        };
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveLoop(loop: MotionLoop): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(loop);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export interface LoopMeta {
  id: string;
  name: string;
  kind: MotionLoop['kind'];
  createdAt: number;
  durationMs: number;
  avatar: string;
  mode: LoopMode;
  thumbSvg: string;
  bytes: number;
}

const toMeta = (l: MotionLoop): LoopMeta => ({
  id: l.id,
  name: l.name,
  kind: l.kind,
  createdAt: l.createdAt,
  durationMs: l.durationMs,
  avatar: l.avatar,
  mode: l.mode,
  thumbSvg: l.thumbSvg,
  bytes: l.bytes,
});

async function getAll(): Promise<MotionLoop[]> {
  const db = await openDb();
  const loops = await new Promise<MotionLoop[]>((resolve, reject) => {
    const req = db.transaction(STORE).objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result as MotionLoop[]);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return loops;
}

/** Newest first. */
export async function listLoops(): Promise<LoopMeta[]> {
  return (await getAll()).map(toMeta).sort((a, b) => b.createdAt - a.createdAt);
}

export async function loadLoop(id: string): Promise<MotionLoop | null> {
  const db = await openDb();
  const loop = await new Promise<MotionLoop | undefined>((resolve, reject) => {
    const req = db.transaction(STORE).objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result as MotionLoop | undefined);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return loop ?? null;
}

export async function deleteLoop(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function renameLoop(id: string, name: string): Promise<void> {
  const loop = await loadLoop(id);
  if (!loop) return;
  loop.name = name.trim() || loop.name;
  await saveLoop(loop);
}

export interface SaveResult {
  saved: boolean;
  /** loops evicted (oldest first) to make room */
  evicted: LoopMeta[];
}

/** Save under the storage bound. When the save would exceed the caps, the
 *  oldest loops are proposed for eviction via `confirmEvict` — nothing is
 *  deleted (and nothing saved) unless the prompt returns true. */
export async function saveLoopBounded(
  loop: MotionLoop,
  confirmEvict: (candidates: LoopMeta[], totals: { bytes: number; loops: number }) => Promise<boolean>,
  caps: StorageCaps = DEFAULT_CAPS,
): Promise<SaveResult> {
  const existing = (await listLoops()).filter((m) => m.id !== loop.id);
  let bytes = existing.reduce((s, m) => s + m.bytes, 0) + loop.bytes;
  let count = existing.length + 1;

  const oldestFirst = [...existing].sort((a, b) => a.createdAt - b.createdAt);
  const candidates: LoopMeta[] = [];
  while ((bytes > caps.maxBytes || count > caps.maxLoops) && oldestFirst.length) {
    const victim = oldestFirst.shift()!;
    candidates.push(victim);
    bytes -= victim.bytes;
    count--;
  }

  if (candidates.length) {
    const ok = await confirmEvict(candidates, {
      bytes: existing.reduce((s, m) => s + m.bytes, 0),
      loops: existing.length,
    });
    if (!ok) return { saved: false, evicted: [] };
    for (const c of candidates) await deleteLoop(c.id);
  }
  await saveLoop(loop);
  return { saved: true, evicted: candidates };
}

/** Storage totals for the library header readout. */
export async function storageTotals(): Promise<{ bytes: number; loops: number; caps: StorageCaps }> {
  const metas = await listLoops();
  return { bytes: metas.reduce((s, m) => s + m.bytes, 0), loops: metas.length, caps: DEFAULT_CAPS };
}
