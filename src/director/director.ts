// Recording director: runs a take script — pre-take framing check,
// 3-2-1 countdown, shot-by-shot serif prompts over the stage, progress in
// the take bar, recorder start/stop. Driven hands-free through the
// gesture/intent seed (raise both arms = start, cross wrists = stop) with
// keyboard always available (space = next shot, esc = stop).

import { LM } from '../pose/indices';
import type { LandmarkPoint } from '../pose/types';
import type { TakeScript } from './scripts';

export interface DirectorDeps {
  startRecording(maxSec: number, takeName: string): void;
  stopRecording(): void;
  ghostOn(): Promise<void>;
  avatarNext(): void;
  coach(eyebrow: string, text: string): void;
  /** latest mirrored normalized landmarks (framing check) */
  latestNorm(): LandmarkPoint[] | null;
  handTracked(): boolean;
}

export interface Director {
  /** Arm a script: framing check → countdown → shots. Returns false if
   *  framing failed (coach explains). */
  begin(script: TakeScript): boolean;
  /** Manual advance (space / palette). */
  advance(): void;
  /** Stop the take (gesture, esc, or script end). */
  stop(): void;
  readonly running: boolean;
}

function framingOk(kind: TakeScript['framing'], norm: LandmarkPoint[] | null, handTracked: boolean): string | null {
  if (kind === 'hand') {
    return handTracked ? null : 'Bring your hand into frame — palm toward the camera.';
  }
  if (!norm) return 'Step into frame so I can see you.';
  const vis = (i: number) => norm[i].visibility > 0.5;
  if (!vis(LM.leftShoulder) || !vis(LM.rightShoulder)) {
    return 'Step back so both shoulders are in frame.';
  }
  if (!vis(LM.leftHip) || !vis(LM.rightHip)) {
    return 'Step back so your hips are visible.';
  }
  if (kind === 'full' && (!vis(LM.leftAnkle) || !vis(LM.rightAnkle))) {
    return 'Step back so your legs are visible — this take uses your whole body.';
  }
  return null;
}

export function createDirector(deps: DirectorDeps): Director {
  const overlay = document.createElement('div');
  overlay.id = 'shot-overlay';
  overlay.className = 'shot-overlay hidden';
  overlay.innerHTML = `
    <div class="so-eyebrow" id="so-eyebrow"></div>
    <div class="so-line serif" id="so-line"></div>`;
  document.getElementById('stage-pane')?.append(overlay);
  const eyebrowEl = overlay.querySelector('#so-eyebrow') as HTMLElement;
  const lineEl = overlay.querySelector('#so-line') as HTMLElement;
  const shotStatus = document.getElementById('shot-status');

  let script: TakeScript | null = null;
  let shotIdx = -1;
  let shotTimer = 0;
  let countdownTimer = 0;
  let running = false;

  function setOverlay(eyebrow: string, line: string): void {
    overlay.classList.remove('hidden');
    eyebrowEl.textContent = eyebrow;
    lineEl.textContent = line;
  }

  function clearTimers(): void {
    clearTimeout(shotTimer);
    clearTimeout(countdownTimer);
  }

  function finish(): void {
    clearTimers();
    running = false;
    script = null;
    shotIdx = -1;
    overlay.classList.add('hidden');
    if (shotStatus) shotStatus.textContent = 'READY';
    deps.stopRecording();
  }

  function runShot(i: number): void {
    if (!script) return;
    if (i >= script.shots.length) {
      finish();
      return;
    }
    shotIdx = i;
    const shot = script.shots[i];
    setOverlay(`Shot ${i + 1} of ${script.shots.length}`, shot.prompt);
    if (shotStatus) shotStatus.textContent = `SHOT ${i + 1}/${script.shots.length}`;
    if (shot.action === 'ghost-on') void deps.ghostOn();
    if (shot.action === 'avatar-next') deps.avatarNext();
    shotTimer = window.setTimeout(() => runShot(i + 1), shot.sec * 1000);
  }

  function countdown(n: number): void {
    if (!script) return;
    if (n === 0) {
      const total = script.shots.reduce((a, s) => a + s.sec, 0) + 4;
      deps.startRecording(total, script.name);
      runShot(0);
      return;
    }
    setOverlay(script.name, String(n));
    countdownTimer = window.setTimeout(() => countdown(n - 1), 1000);
  }

  return {
    get running() {
      return running;
    },
    begin(s) {
      if (running) return false;
      const problem = framingOk(s.framing, deps.latestNorm(), deps.handTracked());
      if (problem) {
        deps.coach('Framing', problem);
        return false;
      }
      script = s;
      running = true;
      countdown(3);
      return true;
    },
    advance() {
      if (!running || shotIdx < 0) return;
      clearTimeout(shotTimer);
      runShot(shotIdx + 1);
    },
    stop() {
      if (!running) return;
      finish();
    },
  };
}
