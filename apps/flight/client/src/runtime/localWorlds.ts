import type { WorldConfig } from "@globefly/shared";

/**
 * BodyArcade original: local single-player world provider.
 *
 * Replaces the server's `/api/worlds/auto-join` + Prisma row for offline
 * play. Worlds are generated client-side (same 8-field WorldConfig shape,
 * same seed math as the server's overflow path) and persisted in
 * localStorage. The multiplayer/server codepath stays intact behind
 * `VITE_FLIGHT_SERVER=1`.
 */

const WORLDS_KEY = "globefly_local_worlds_v1";
const LANTERNS_KEY = "globefly_local_lanterns_v1";
const MAX_STORED_WORLDS = 24;

/** Name pools copied from server/src/utils/worldNames.ts (same author/permission). */
const ADJECTIVES = [
  "Emerald", "Whispering", "Golden", "Misty", "Crimson",
  "Sapphire", "Drifting", "Luminous", "Frosted", "Ancient",
  "Velvet", "Silent", "Coral", "Amber", "Twilight",
  "Azure", "Hollow", "Sunken", "Wandering", "Forgotten",
  "Crystal", "Mossy", "Starlit", "Ivory", "Painted",
  "Dusky", "Shimmering", "Rugged", "Verdant", "Phantom",
];

const NOUNS = [
  "Archipelago", "Peaks", "Lagoon", "Tundra", "Meadows",
  "Reef", "Horizon", "Canopy", "Shores", "Expanse",
  "Valley", "Isles", "Frontier", "Hollows", "Drift",
  "Fjords", "Caldera", "Ravine", "Steppe", "Atoll",
  "Bluffs", "Cascade", "Enclave", "Thicket", "Narrows",
  "Basin", "Spires", "Marshlands", "Coves", "Ridge",
];

/** Remote (upstream server) mode is opt-in; local single-player is the default. */
export function isLocalMode(): boolean {
  return String(import.meta.env.VITE_FLIGHT_SERVER ?? "") !== "1";
}

interface LocalWorldStore {
  worlds: WorldConfig[];
  /** Slug the player was in last session; rejoined on next launch. */
  lastSlug?: string;
}

function loadStore(): LocalWorldStore {
  try {
    const raw = localStorage.getItem(WORLDS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LocalWorldStore;
      if (Array.isArray(parsed.worlds)) return parsed;
    }
  } catch {
    // corrupted store → regenerate
  }
  return { worlds: [] };
}

function saveStore(store: LocalWorldStore) {
  try {
    localStorage.setItem(WORLDS_KEY, JSON.stringify(store));
  } catch {
    // quota/private mode: world stays session-only, game still runs
  }
}

function generateWorldName(existing: Set<string>): string {
  for (let i = 0; i < 200; i++) {
    const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]!;
    const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)]!;
    const name = `${adj} ${noun}`;
    if (!existing.has(name)) return name;
  }
  return `World ${Date.now()}`;
}

function randomSlug(): string {
  // nanoid-shaped 10-char id without the dependency
  const alphabet = "useandom26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict";
  let s = "";
  for (let i = 0; i < 10; i++) {
    s += alphabet[Math.floor(Math.random() * alphabet.length)]!;
  }
  return s;
}

function createWorld(existingNames: Set<string>): WorldConfig {
  // Field-for-field what the server's overflow path creates.
  return {
    id: randomSlug(),
    slug: randomSlug(),
    name: generateWorldName(existingNames),
    globeRadius: 5.0,
    texture: "earth",
    seed: Math.floor(Math.random() * 2147483647),
    terrainType: "default",
    createdBy: "Local",
  };
}

/**
 * Local counterpart of `POST /api/worlds/auto-join`: rejoin the last world
 * when possible, otherwise mint a new one. `excludeSlug` forces a fresh
 * world (the in-game "find a new world" flow).
 */
export function localAutoJoin(opts?: { excludeSlug?: string }): WorldConfig {
  const store = loadStore();

  if (!opts?.excludeSlug && store.lastSlug) {
    const last = store.worlds.find((w) => w.slug === store.lastSlug);
    if (last) return last;
  }
  const candidate = store.worlds.find((w) => w.slug !== opts?.excludeSlug);
  if (candidate && !opts?.excludeSlug) {
    store.lastSlug = candidate.slug;
    saveStore(store);
    return candidate;
  }

  const names = new Set(store.worlds.map((w) => w.name));
  const world = createWorld(names);
  store.worlds.push(world);
  if (store.worlds.length > MAX_STORED_WORLDS) {
    store.worlds.splice(0, store.worlds.length - MAX_STORED_WORLDS);
  }
  store.lastSlug = world.slug;
  saveStore(store);
  return world;
}

/** Local counterpart of `POST /api/lanterns/add` (the LanternLedger row). */
export function localLanternAdd(count: number, worldSlug: string) {
  try {
    const raw = localStorage.getItem(LANTERNS_KEY);
    const ledger = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    ledger[worldSlug] = (ledger[worldSlug] ?? 0) + count;
    localStorage.setItem(LANTERNS_KEY, JSON.stringify(ledger));
  } catch {
    // best-effort, same as upstream's fire-and-forget fetch
  }
}
