// Capability manifest access: data/avatar-capabilities.json is the single
// small, hand-reviewed source of truth for what each roster avatar may
// enact. EVERY gate (finger fusion, face-touch class, feet, card labels,
// coach lines) reads from here — code never re-derives capability at
// runtime, so a wrong manifest is visible and reviewable, never silent.
// Regenerate/verify the inspection blocks: node scripts/capability-report.mjs

import manifestJson from '../../data/avatar-capabilities.json';
import type { AvatarId } from './avatarRegistry';

export type FaceTouchClass = 'full' | 'limited' | 'none';

export interface AvatarCaps {
  fingers: boolean;
  /** required when fingers=false despite passing chains — the reviewed
   *  reason for the demotion (see the astronaut's mitten mesh) */
  fingersNote?: string;
  faceTouch: FaceTouchClass;
  /** reviewed reason when faceTouch is not "full" (geometry limits etc.) */
  faceTouchNote?: string;
  feet: boolean;
  fullBody: boolean;
}

export interface AvatarCapEntry {
  type: 'procedural' | 'vrm';
  localOnly?: boolean;
  capabilities: AvatarCaps;
  labels: { chip: string; chipClass: 'ok' | 'exp' | 'warn'; note: string };
  coach?: string;
}

interface Manifest {
  version: number;
  avatars: Record<string, AvatarCapEntry>;
}

const manifest = manifestJson as unknown as Manifest;

/** Most-restrictive default: an avatar the manifest doesn't know gets no
 *  finger driving, limited face-touch, no feet features, and an honest chip. */
const UNKNOWN: AvatarCapEntry = {
  type: 'vrm',
  capabilities: { fingers: false, faceTouch: 'limited', feet: false, fullBody: false },
  labels: { chip: 'Experimental', chipClass: 'exp', note: 'not in the capability manifest — conservative defaults' },
  coach: 'This avatar has no reviewed capability entry — finger and feet features stay off.',
};

export function capsFor(id: AvatarId | string): AvatarCapEntry {
  return manifest.avatars[id] ?? UNKNOWN;
}

/** The absolute gate for O2: finger data flows only to manifest-approved rigs. */
export function fingersApproved(id: AvatarId | string): boolean {
  return capsFor(id).capabilities.fingers === true;
}

export function manifestVersion(): number {
  return manifest.version;
}
