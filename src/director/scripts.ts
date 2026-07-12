// Guided take scripts — DATA, not code. Each script is a shot list for a
// 15–25 s clip; prompts are instrument language (plain verbs, directed at
// the performer). Adding a take = adding an object here.
//
// V2 (V7): shots can carry a presentation preset (`present` — the camera
// treatment for that shot; unset restores the performer's own setting)
// and a `replay` action (the shot plays your last seconds in slow motion
// through Motion Memory ghosts — the recorder keeps rolling, so the
// replay lands INSIDE the take).

import type { PresentMode } from '../record/presentation';

export interface Shot {
  /** serif overlay line the performer reads at a glance */
  prompt: string;
  /** seconds this shot runs before auto-advancing */
  sec: number;
  /** director side-effect when the shot begins */
  action?: 'ghost-on' | 'avatar-next' | 'replay';
  /** camera presentation for this shot; unset = the performer's setting */
  present?: PresentMode;
  /** skeleton-ghost overlay on the cutout during this shot */
  skeleton?: boolean;
}

export interface TakeScript {
  id: string;
  name: string;
  mode: 'character' | 'hand';
  /** framing the pre-take check requires */
  framing: 'upper' | 'full' | 'hand';
  shots: Shot[];
}

export const TAKE_SCRIPTS: TakeScript[] = [
  {
    id: 'character',
    name: 'Character take',
    mode: 'character',
    framing: 'upper',
    shots: [
      { prompt: 'Stand easy, look at the camera', sec: 2.5 },
      { prompt: 'Raise both arms slowly', sec: 3 },
      { prompt: 'Lean left, then right', sec: 3 },
      { prompt: 'Touch your cheek, hold it', sec: 3 },
      { prompt: 'Shadowbox — three fast punches', sec: 3 },
      { prompt: 'Keep moving…', sec: 2.5, action: 'avatar-next' },
      { prompt: 'Strike a final pose', sec: 2.5 },
      { prompt: 'Hold — watch your replay', sec: 6, action: 'replay' },
    ],
  },
  {
    id: 'ghost-duet',
    name: 'Ghost duet',
    mode: 'character',
    framing: 'upper',
    shots: [
      { prompt: 'Perform a short phrase — 8 seconds', sec: 8 },
      { prompt: 'Now duet with your ghost', sec: 8, action: 'ghost-on' },
      { prompt: 'Mirror it. Answer it. Final pose', sec: 4 },
    ],
  },
  {
    id: 'cutout-duet',
    name: 'Cutout duet',
    mode: 'character',
    framing: 'upper',
    shots: [
      { prompt: 'You are on stage now — take a bow', sec: 4, present: 'stage' },
      { prompt: 'Perform a phrase beside your avatar', sec: 7, present: 'stage' },
      { prompt: 'Ghost joins — three of you now', sec: 7, present: 'stage', action: 'ghost-on' },
      { prompt: 'Final pose, all together', sec: 4, present: 'stage' },
    ],
  },
  {
    id: 'presentation-reel',
    name: 'Presentation reel',
    mode: 'character',
    framing: 'upper',
    shots: [
      { prompt: 'Wave — this is the plain camera', sec: 3.5, present: 'raw' },
      { prompt: 'Keep moving — the room falls out of focus', sec: 3.5, present: 'blur' },
      { prompt: 'Now the room disappears entirely', sec: 3.5, present: 'cutout' },
      { prompt: 'You are made of light', sec: 3.5, present: 'silhouette', skeleton: true },
      { prompt: 'And now you are ON the stage — big finish', sec: 5, present: 'stage' },
    ],
  },
  {
    id: 'talking-puppet',
    name: 'Talking puppet',
    mode: 'hand',
    framing: 'hand',
    shots: [
      { prompt: 'Bring your hand up — beaky wakes', sec: 3 },
      { prompt: 'Talk with your hand — pinch the rhythm', sec: 8 },
      { prompt: 'Look left, look right, big finish', sec: 5 },
    ],
  },
];
