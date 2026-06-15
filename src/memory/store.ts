// Motion Memory persistence: named loops in IndexedDB. Fully local —
// structured clone stores the Int16Arrays natively, no serialization
// ceremony, nothing ever leaves the machine.

import type { MotionLoop } from './stream';

const DB_NAME = 'posepuppet-memory';
const STORE = 'loops';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: 'id' });
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
}

export async function listLoops(): Promise<LoopMeta[]> {
  const db = await openDb();
  const loops = await new Promise<MotionLoop[]>((resolve, reject) => {
    const req = db.transaction(STORE).objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result as MotionLoop[]);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return loops
    .map(({ id, name, kind, createdAt, durationMs }) => ({ id, name, kind, createdAt, durationMs }))
    .sort((a, b) => b.createdAt - a.createdAt);
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
