// Guided take scripts — DATA, not code. Each script is a shot list for a
// 15–20 s clip; prompts are instrument language (plain verbs, directed at
// the performer). Adding a take = adding an object here.

export interface Shot {
  /** serif overlay line the performer reads at a glance */
  prompt: string;
  /** seconds this shot runs before auto-advancing */
  sec: number;
  /** director side-effect when the shot begins */
  action?: 'ghost-on' | 'avatar-next';
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
