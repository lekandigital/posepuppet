// Graybox readout — an engineering strip, not a game HUD: status word,
// cadence, speed, yaw rate, gait source, comfort envelope maxima, coach
// line, recenter toast, and the comfort vignette overlay. Mono, dark,
// minimal — the frozen PosePuppet visual language for diagnostics.

import type { WalkEnvelope, WalkHudState, WalkPose } from '@bodyarcade/locomotion';
import { WALK_STATUS, coachLine } from '@bodyarcade/locomotion';

export interface GrayboxHud {
  update(pose: WalkPose, hud: WalkHudState, envelope: WalkEnvelope, cameraDenied: boolean): void;
  dispose(): void;
}

const MONO = "ui-monospace, 'JetBrains Mono', Menlo, monospace";

export function createGrayboxHud(container: HTMLElement): GrayboxHud {
  const strip = document.createElement('div');
  strip.dataset.testid = 'walk-strip';
  strip.style.cssText = [
    'position:fixed', 'left:50%', 'bottom:14px', 'transform:translateX(-50%)',
    'display:flex', 'gap:18px', 'align-items:baseline',
    'padding:8px 14px', 'background:rgba(10,12,16,0.78)',
    'border:1px solid rgba(255,255,255,0.16)', 'border-radius:4px',
    `font:12px/1.4 ${MONO}`, 'color:#cfd8e3', 'letter-spacing:0.04em',
    'z-index:30', 'pointer-events:none', 'white-space:nowrap',
  ].join(';');

  const cell = (id: string, label: string): HTMLSpanElement => {
    const wrap = document.createElement('span');
    const lab = document.createElement('span');
    lab.textContent = label + ' ';
    lab.style.color = '#5d6a80';
    const val = document.createElement('span');
    val.dataset.testid = id;
    wrap.append(lab, val);
    strip.appendChild(wrap);
    return val;
  };

  const elStatus = cell('walk-status', 'WALK');
  const elCadence = cell('walk-cadence', 'CADENCE');
  const elSpeed = cell('walk-speed', 'SPEED');
  const elYaw = cell('walk-yaw', 'YAW');
  const elSource = cell('walk-source', 'SRC');
  const elEnv = cell('walk-env', 'ENV');
  container.appendChild(strip);

  const coach = document.createElement('div');
  coach.dataset.testid = 'walk-coach';
  coach.style.cssText = [
    'position:fixed', 'left:50%', 'bottom:56px', 'transform:translateX(-50%)',
    'padding:6px 12px', 'background:rgba(10,12,16,0.72)',
    'border:1px solid rgba(255,255,255,0.12)', 'border-radius:4px',
    `font:12px/1.4 ${MONO}`, 'color:#9fb4d8', 'z-index:30',
    'pointer-events:none', 'display:none',
  ].join(';');
  container.appendChild(coach);

  const toast = document.createElement('div');
  toast.dataset.testid = 'walk-toast';
  toast.style.cssText = [
    'position:fixed', 'left:50%', 'top:18%', 'transform:translateX(-50%)',
    'padding:8px 16px', 'background:rgba(16,20,28,0.85)',
    'border:1px solid rgba(159,180,216,0.5)', 'border-radius:4px',
    `font:13px/1.4 ${MONO}`, 'color:#dfe8f5', 'z-index:31',
    'pointer-events:none', 'display:none',
  ].join(';');
  toast.textContent = 'Neutral recaptured';
  container.appendChild(toast);
  let toastUntil = 0;

  // comfort vignette — a radial gradient the model drives; display only
  const vig = document.createElement('div');
  vig.dataset.testid = 'walk-vignette';
  vig.style.cssText = [
    'position:fixed', 'inset:0', 'pointer-events:none', 'z-index:20',
    'background:radial-gradient(ellipse at center, transparent 42%, rgba(8,10,14,0.9) 100%)',
    'opacity:0', 'transition:none',
  ].join(';');
  container.appendChild(vig);

  return {
    update(pose, hud, env, cameraDenied): void {
      elStatus.textContent =
        cameraDenied && pose.mode !== 'keyboard' ? 'CAMERA OFF' : WALK_STATUS[pose.mode];
      elStatus.style.color = pose.mode === 'autopilot' ? '#e8b34e' : '#cfd8e3';
      elCadence.textContent = `${hud.cadence.toFixed(2)}/s`;
      elSpeed.textContent = `${pose.speed.toFixed(2)} m/s`;
      elYaw.textContent = `${pose.yawRateDps.toFixed(0)}°/s`;
      elSource.textContent = hud.source.toUpperCase();
      elEnv.textContent =
        `v≤${env.maxSpeed.toFixed(1)} a≤${env.maxAccel.toFixed(1)} ω≤${env.maxYawRateDps.toFixed(0)}`;

      const line = coachLine(hud, pose.mode, cameraDenied);
      coach.style.display = line ? 'block' : 'none';
      if (line) coach.textContent = line;

      const now = performance.now();
      if (pose.recentered) toastUntil = now + 2200;
      toast.style.display = now < toastUntil ? 'block' : 'none';

      vig.style.opacity = pose.vignette.toFixed(3);
    },
    dispose(): void {
      strip.remove();
      coach.remove();
      toast.remove();
      vig.remove();
    },
  };
}
