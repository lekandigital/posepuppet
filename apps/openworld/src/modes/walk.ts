// Region walking — V3's @bodyarcade/locomotion integrated per its own
// INTEGRATION.md (written for this milestone). REUSED UNCHANGED:
// createWalkController (transports + WASD/arrows + keyboard-priority),
// createLocomotion (comfort caps enforced at model output — the package
// owns the nausea contract), WALK_STATUS/coachLine strings. Owned here:
// PathHint from the baked nav.walk (WorldRuntime), terrain ground clamp
// (slopes are a render-side offset, per contract), settlement spawn,
// comfort-vignette rendering, minimap.

import {
  createLocomotion, createWalkController, coachLine, WALK_STATUS,
  type WalkPose,
} from '@bodyarcade/locomotion';
import type { GameMode, ModeContext } from './types';
import { createMinimap, type Minimap } from '../ui/minimap';

const DEG = Math.PI / 180;

export class WalkMode implements GameMode {
  readonly id = 'walk';
  private ctx: ModeContext;
  private controller = createWalkController(window);
  private loco = createLocomotion();
  private minimap: Minimap;
  private vignetteEl: HTMLDivElement;
  private lastPose: WalkPose;
  private toastLeft = 0;
  private traveled = 0;
  private lastTs: number | null = null;
  cameraDenied = false;

  constructor(ctx: ModeContext) {
    this.ctx = ctx;
    this.minimap = createMinimap(document.body, ctx.world);
    this.vignetteEl = document.createElement('div');
    this.vignetteEl.dataset.testid = 'ow-vignette';
    this.vignetteEl.style.cssText =
      'position:fixed;inset:0;pointer-events:none;z-index:20;opacity:0;' +
      'background:radial-gradient(ellipse at center, transparent 55%, rgba(6,8,12,0.9) 100%)';
    document.body.appendChild(this.vignetteEl);
    this.lastPose = this.loco.pose();
  }

  enter(): void {
    const spawn = this.ctx.world.spawn('walk');
    // face along the local path so the first steps read correctly
    this.ctx.world.setHintHeading(0);
    const hint = this.ctx.world.walkHint(spawn.x, spawn.z);
    const yaw = hint ? Math.atan2(hint.dirX, -hint.dirZ) / DEG : spawn.yawDeg;
    this.loco.teleport(spawn.x, spawn.z, yaw);
    this.ctx.chrome.setMode('walk');
  }

  /** Transition entry: place the walker at a specific point. */
  enterAt(x: number, z: number, yawDeg: number): void {
    this.ctx.world.setHintHeading(yawDeg);
    const hint = this.ctx.world.walkHint(x, z);
    const yaw = hint ? Math.atan2(hint.dirX, -hint.dirZ) / DEG : yawDeg;
    this.loco.teleport(x, z, yaw);
  }

  update(_dtS: number, _timeS: number): void {
    const now = performance.now();
    const world = this.ctx.world;
    const intent = this.controller.intent(now);
    world.setHintHeading(this.lastPose.yawDeg);
    const pose = this.loco.step(now, intent, world.walkHint);
    if (this.lastTs !== null) {
      this.traveled += Math.abs(pose.speed) * Math.min((now - this.lastTs) / 1000, 0.25);
    }
    this.lastTs = now;
    this.lastPose = pose;

    // first-person rig: yaw only; ground clamp is the render-side offset
    const groundY = Math.max(world.groundY(pose.x, pose.z), world.seaLevel);
    this.ctx.camera.position.set(pose.x, groundY + pose.eyeY, pose.z);
    this.ctx.camera.rotation.set(0, -pose.yawDeg * DEG, 0);

    this.vignetteEl.style.opacity = String(pose.vignette);
    this.minimap.update(pose.x, pose.z, pose.yawDeg);

    const hud = this.controller.hudState();
    if (hud.recentered || pose.recentered) this.toastLeft = 2.5;
    const status = WALK_STATUS[pose.mode] ?? pose.mode.toUpperCase();
    this.ctx.chrome.setStatus(
      `WALK · ${status} · ${pose.speed.toFixed(1)} M/S · ` +
      `CADENCE ${Math.round(hud.cadence * 60)} · SRC ${hud.source.toUpperCase()}`,
    );
    if (this.toastLeft > 0) {
      this.toastLeft -= 0.016;
      this.ctx.chrome.setCoach('Neutral recaptured.');
    } else {
      this.ctx.chrome.setCoach(coachLine(hud, pose.mode, this.cameraDenied) ?? '');
    }
  }

  state(): Record<string, unknown> {
    const p = this.lastPose;
    return {
      x: p.x, z: p.z, yawDeg: p.yawDeg, speed: p.speed, eyeY: p.eyeY,
      mode: p.mode, vignette: p.vignette, traveled: this.traveled,
      envelope: this.loco.envelope(),
      camTilt: [this.ctx.camera.rotation.x, this.ctx.camera.rotation.z],
      lateral: this.ctx.world.walkHint(p.x, p.z)?.lateral ?? null,
    };
  }

  dispose(): void {
    this.controller.dispose();
    this.minimap.dispose();
    this.vignetteEl.remove();
  }
}
