// Coach + HUD strings for walking — instrument language (plain verbs,
// direct, sentence case). V4 mounts these verbatim; keeping them in the
// package means every profile ships the same words.

import type { WalkHudState } from './controller';
import type { WalkMode } from './types';

/** Mono status word for the HUD strip. */
export const WALK_STATUS: Record<WalkMode, string> = {
  idle: 'READY',
  walk: 'WALKING',
  glide: 'GLIDING',
  keyboard: 'KEYBOARD',
  autopilot: 'SIGNAL LOST',
};

export const WALK_COACH = {
  marchToWalk: 'March in place to walk — lift your knees',
  swayToWalk: 'Shift your weight side to side to walk',
  legsHidden: 'Legs out of view — weight-shift walking is active',
  leanToSteer: 'Lean left or right to steer',
  seatedGlide: 'Seated: lean forward to glide, lean sideways to steer',
  crouchDuck: 'Crouch to duck and slow down',
  trackingLost: 'Tracking lost — easing to a stop. Step back into frame',
  reacquired: 'Tracking is back',
  recentered: 'Neutral recaptured',
  recenterHint: 'Hold a T-pose for a second to recenter',
  keyboard: 'Keyboard control — body input resumes when the keys go quiet',
  cameraDenied: 'Camera off — walk with W A S D or the arrow keys',
} as const;

/** Least-annoying coach policy: one line, only when something needs
 *  attention; silence while things work. */
export function coachLine(
  hud: WalkHudState,
  mode: WalkMode,
  cameraDenied: boolean,
): string | null {
  if (cameraDenied) return WALK_COACH.cameraDenied;
  if (hud.recentered) return WALK_COACH.recentered;
  if (mode === 'autopilot') return WALK_COACH.trackingLost;
  if (mode === 'keyboard') return null; // deliberate — don't nag keyboard users
  if (hud.seated && mode !== 'glide') return WALK_COACH.seatedGlide;
  if (mode === 'idle' && hud.tracking === 'live') {
    return hud.source === 'sway' ? WALK_COACH.swayToWalk : WALK_COACH.marchToWalk;
  }
  return null;
}
