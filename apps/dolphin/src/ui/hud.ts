// Mono HUD: status readout (depth / speed / kick rhythm / assist /
// tracking), plain-verb coach lines (direct, low-nag), keyboard help,
// and the standing ODbL attribution — a shipping requirement, not chrome.

import type { AssistMode, SimState } from '../game/sim';
import type { TrackingStateHud } from '../input/swimControls';

const COACH_HOLD_MS = 4000;

export class Hud {
  private status = document.getElementById('hud-status')!;
  private coach = document.getElementById('hud-coach')!;
  private help = document.getElementById('hud-help')!;
  private attrib = document.getElementById('hud-attrib')!;
  private coachUntil = 0;
  private lastCoach = '';
  private quietSinceMs: number | null = null;

  constructor(attribution: string) {
    this.help.innerHTML =
      'body: bob chest to kick · lean = dive/turn · hands forward = burst · T-pose = recenter<br>' +
      'keys: W/S dive · A/D turn · Q/E depth · Shift kick · Space burst · 1/2/3 assist';
    this.attrib.textContent = `${attribution} (ODbL) · all local, nothing uploaded`;
  }

  say(line: string, now: number): void {
    if (line === this.lastCoach && now < this.coachUntil + 8000) return; // low-nag
    this.lastCoach = line;
    this.coachUntil = now + COACH_HOLD_MS;
    this.coach.textContent = line;
    this.coach.classList.remove('hidden');
  }

  update(
    s: SimState,
    tracking: TrackingStateHud,
    kickRate: number,
    assist: AssistMode,
    seated: boolean,
    recentered: boolean,
    now: number,
  ): void {
    const depth = Math.max(0, -s.y).toFixed(1);
    const rhythm = kickRate > 0 ? `${kickRate.toFixed(2)} Hz` : '—';
    this.status.innerHTML =
      `DEPTH ${depth} m · SPEED ${s.speed.toFixed(1)} m/s<br>` +
      `KICK ${rhythm} · KICKS ${s.kickCount} · BREACHES ${s.breachCount}<br>` +
      `ASSIST ${assist.toUpperCase()} · TRACKING ${tracking.toUpperCase()}${seated ? ' · SEATED' : ''}`;

    if (recentered) this.say('Recentered — this pose is your neutral now', now);
    else if (tracking === 'autopilot' || tracking === 'stale' || tracking === 'low-confidence') {
      this.say('Tracking lost — gliding. Step back into frame', now);
    } else if (tracking === 'live' && kickRate === 0 && s.speed < 2.2) {
      if (this.quietSinceMs === null) this.quietSinceMs = now;
      if (now - this.quietSinceMs > 6000) {
        this.say('Bob your chest and hips in a wave to kick — keep hips in frame', now);
      }
    } else {
      this.quietSinceMs = null;
    }
    if (now > this.coachUntil) this.coach.classList.add('hidden');
  }
}
