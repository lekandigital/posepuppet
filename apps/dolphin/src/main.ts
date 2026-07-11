// BodyArcade Dolphin — boot. Body signals arrive from PosePuppet
// (BroadcastChannel same-origin, or the postMessage relay when opened by
// the producer); keyboard always works. Everything is local: no network,
// no telemetry, the bay outline ships in the bundle.

import { startGame } from './game/game';

startGame(document.getElementById('app')!);
