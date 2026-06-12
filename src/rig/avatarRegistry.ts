// Avatar registry: maps avatar IDs to their definitions and provides helpers
// for cycling, loading, and validation. Keeps main.ts free of per-avatar
// conditionals — add a new avatar by appending one entry here.

import { loadVrmAvatar } from './vrm';
import { createRobot } from './robot';
import type { Avatar } from './types';

/** Supported avatar identifiers. */
export type AvatarId = 'robot' | 'astronaut' | 'woody';

interface AvatarDef {
  id: AvatarId;
  label: string;
  type: 'procedural' | 'vrm';
  /** VRM/GLB URL served from public/. Only for type='vrm'. */
  url?: string;
  /** Local-only asset (not in the repo/deploy): hidden from cycling when
   *  its file is absent. Gate-1 decision for woody (non-redistributable). */
  optional?: boolean;
}

const REGISTRY: readonly AvatarDef[] = [
  { id: 'robot', label: 'robot', type: 'procedural' },
  { id: 'astronaut', label: 'astronaut', type: 'vrm', url: '/avatars/astronaut.vrm' },
  { id: 'woody', label: 'woody', type: 'vrm', url: '/avatars/woody.vrm', optional: true },
] as const;

/** IDs whose optional asset probe failed; excluded from cycling. */
const unavailable = new Set<AvatarId>();

/** Probe optional avatar files once at boot (same-origin HEAD requests,
 *  part of asset loading — before the privacy receipt starts counting).
 *  A missing file silently leaves the cycle instead of erroring at switch
 *  time. */
export async function probeOptionalAvatars(): Promise<void> {
  await Promise.all(
    REGISTRY.filter((d) => d.optional && d.url).map(async (d) => {
      try {
        const res = await fetch(d.url!, { method: 'HEAD' });
        if (!res.ok) unavailable.add(d.id);
      } catch {
        unavailable.add(d.id);
      }
    }),
  );
}

export function isAvatarAvailable(id: AvatarId): boolean {
  return !unavailable.has(id);
}

/** Look up a definition by ID. Throws on unknown ID (should be validated
 *  at the boundary). */
export function getAvatarDef(id: AvatarId): AvatarDef {
  const def = REGISTRY.find((d) => d.id === id);
  if (!def) throw new Error(`Unknown avatar id: ${id}`);
  return def;
}

/** Cycle order: robot → astronaut → woody → robot, skipping avatars whose
 *  optional file is absent on this machine. */
export function nextAvatarId(id: AvatarId): AvatarId {
  const idx = REGISTRY.findIndex((d) => d.id === id);
  for (let step = 1; step <= REGISTRY.length; step++) {
    const next = REGISTRY[(idx + step) % REGISTRY.length];
    if (isAvatarAvailable(next.id)) return next.id;
  }
  return 'robot'; // unreachable: robot is never optional
}

/** Type-guard for URL param / localStorage values. */
export function isAvatarId(value: string): value is AvatarId {
  return REGISTRY.some((d) => d.id === value);
}

/** Load an avatar by ID. Robot is synchronous but wrapped in a promise for
 *  a uniform interface. VRM avatars go through loadVrmAvatar(). */
export async function loadAvatarById(id: AvatarId): Promise<Avatar> {
  const def = getAvatarDef(id);
  if (def.type === 'procedural') return createRobot();
  return loadVrmAvatar(def.url!);
}
