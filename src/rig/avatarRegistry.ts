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
}

const REGISTRY: readonly AvatarDef[] = [
  { id: 'robot', label: 'robot', type: 'procedural' },
  { id: 'astronaut', label: 'astronaut', type: 'vrm', url: '/avatars/astronaut.vrm' },
  { id: 'woody', label: 'woody', type: 'vrm', url: '/avatars/woody.vrm' },
] as const;

/** Look up a definition by ID. Throws on unknown ID (should be validated
 *  at the boundary). */
export function getAvatarDef(id: AvatarId): AvatarDef {
  const def = REGISTRY.find((d) => d.id === id);
  if (!def) throw new Error(`Unknown avatar id: ${id}`);
  return def;
}

/** Cycle order: robot → astronaut → woody → robot. */
export function nextAvatarId(id: AvatarId): AvatarId {
  const idx = REGISTRY.findIndex((d) => d.id === id);
  return REGISTRY[(idx + 1) % REGISTRY.length].id;
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
