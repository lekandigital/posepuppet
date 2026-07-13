// Region rowing — the completed Rowing control system on the fjord.
// REUSED UNCHANGED: RowingControls (stroke→impulse queue, lean/asymmetry
// steering profiles, cruise latch, loss autopilot, keyboard priority,
// steeringIntent — every Gate-2 lesson included). Owned here: hull
// dynamics in metres (impulse-and-glide, the completed Boat's feel
// ratios), speed-coupled carve yaw (the 360°-pivot fix pattern), shore
// guard from the world SDF (safety NOT scaled by intent — the coxswain
// lesson kept), dock spawn onto the row network, oar visuals, camera.

import * as THREE from 'three';
import { RowingControls } from '@flight-input/rowControls';
import type { ControlState } from '@flight-game/FlightControls';
import type { GameMode, ModeContext } from './types';
import { createRowboat, type BoatRig } from '../vehicles/rowboat';
import { createMinimap, type Minimap } from '../ui/minimap';

export const ROW = {
  STROKE_IMPULSE: 1.9,   // m/s banked per full-strength pull
  SURGE_ATTACK_TAU: 0.3, // the visible per-stroke lunge (rowing-proven)
  GLIDE_TAU: 7.0,        // proportional drag — long glide, never a hard stop
  MAX_SPEED: 4.2,
  CRUISE_SPEED: 2.4,     // held while the cruise latch is on
  KB_SPEED: 2.8,         // keyboard forward target
  KB_ACCEL: 1.6,
  KB_DECEL: 2.6,
  YAW_DPS_PER_UNIT: 26,  // deg/s per turnRate unit at full way
  TURN_SMOOTH: 8,        // TinySkies boat feel
  // shore guard (SDF): soft push + heading bias, safety over authority
  GUARD_BAND_M: 26,
  GUARD_PUSH: 2.6,       // m/s² inward acceleration at the shore
  GUARD_YAW_DPS: 30,
  MIN_DEPTH_M: 0.35,
} as const;

const DEG = Math.PI / 180;

export class RowMode implements GameMode {
  readonly id = 'row';
  readonly controls: RowingControls;
  private ctx: ModeContext;
  private rig: BoatRig;
  private minimap: Minimap;
  private keys = new Set<string>();

  x = 0; z = 0;
  yawDeg = 0;
  speed = 0;
  private surge = 0;
  private turnSmooth = 0;
  private kbTarget = 0;
  private guardCoach = 0;
  private toastLeft = 0;
  strokesSeen = 0;
  traveled = 0;

  constructor(ctx: ModeContext) {
    this.ctx = ctx;
    this.controls = new RowingControls();
    this.rig = createRowboat();
    ctx.scene.add(this.rig.root);
    this.minimap = createMinimap(document.body, ctx.world);
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKeyUp);
  }

  private onKey = (e: KeyboardEvent): void => {
    const k = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(k)) {
      this.keys.add(k);
      e.preventDefault();
    }
  };
  private onKeyUp = (e: KeyboardEvent): void => { this.keys.delete(e.key.toLowerCase()); };

  /** Keyboard ControlState (arrows or WASD — rowing convention). */
  private kbState(): ControlState {
    let turnRate = 0;
    if (this.keys.has('arrowleft') || this.keys.has('a')) turnRate += 1.2;
    if (this.keys.has('arrowright') || this.keys.has('d')) turnRate -= 1.2;
    return {
      turnRate,
      forward: this.keys.has('arrowup') || this.keys.has('w'),
      brake: this.keys.has('arrowdown') || this.keys.has('s'),
      elevate: false, descend: false, paintball: false,
      specialAction: false, interact: false,
    };
  }

  enter(): void {
    const world = this.ctx.world;
    const dock = world.spawn('dock');
    // put the hull ON the row network (guaranteed rowable water), facing
    // away from the shore
    const node = world.nearestRowNode(dock.x, dock.z);
    const [nx, nz] = world.rowNodeScene(node);
    this.x = nx;
    this.z = nz;
    const g = this.sdfGradient(nx, nz);
    this.yawDeg = Math.atan2(g[0], -g[1]) / DEG;
    this.speed = 0;
    this.ctx.chrome.setMode('row');
  }

  /** SDF gradient (points toward deeper water), normalized. */
  private sdfGradient(x: number, z: number): [number, number] {
    const world = this.ctx.world;
    const E = 4;
    const dx = world.shoreSDF(x + E, z) - world.shoreSDF(x - E, z);
    const dz = world.shoreSDF(x, z + E) - world.shoreSDF(x, z - E);
    const len = Math.hypot(dx, dz) || 1;
    return [dx / len, dz / len];
  }

  update(dtS: number, timeS: number): void {
    const world = this.ctx.world;
    const merged = this.controls.merge(this.kbState());
    const kbOwns = this.controls.keyboardOwns;
    const bodyOwns = this.controls.bodyActive;

    // --- propulsion ---------------------------------------------------
    for (const strength of this.controls.consumeStrokes()) {
      this.surge += ROW.STROKE_IMPULSE * strength;
      this.strokesSeen++;
      this.rig.pulse(strength);
    }
    // surge attack: banked impulse flows into speed (the rowing lunge)
    const flow = this.surge * Math.min(1, dtS / ROW.SURGE_ATTACK_TAU);
    this.surge -= flow;
    this.speed += flow;

    if (kbOwns) {
      const st = this.kbState();
      if (st.forward) this.kbTarget = ROW.KB_SPEED;
      else if (st.brake) this.kbTarget = 0;
      if (st.forward || this.kbTarget > this.speed) {
        const rate = st.forward ? ROW.KB_ACCEL : ROW.KB_DECEL;
        this.speed += Math.max(-rate * dtS, Math.min(rate * dtS, this.kbTarget - this.speed));
      }
    } else {
      this.kbTarget = 0;
    }

    // cruise: resting after a steady rhythm holds momentum
    if (bodyOwns && this.controls.cruising) {
      this.speed = Math.max(this.speed - dtS / ROW.GLIDE_TAU * this.speed, ROW.CRUISE_SPEED * 0.92);
    } else {
      // proportional drag — glide, never a hard stop
      this.speed *= Math.exp(-dtS / ROW.GLIDE_TAU);
    }
    this.speed = Math.min(this.speed, ROW.MAX_SPEED);

    // --- steering: carve, never pivot ------------------------------------
    let turn = merged.turnRate;
    // shore guard: hazard ramps as the shoreline nears; bias toward deep
    // water. NOT scaled by steering intent (safety outranks authority),
    // but the inward PUSH prevents beaching even at full defiance.
    const sdf = world.shoreSDF(this.x, this.z);
    const depth = world.waterDepth(this.x, this.z);
    const hazard = Math.max(
      0,
      Math.min(1, 1 - Math.min(sdf, (depth - ROW.MIN_DEPTH_M) * 12) / ROW.GUARD_BAND_M),
    );
    if (hazard > 0) {
      const g = this.sdfGradient(this.x, this.z);
      const desired = Math.atan2(g[0], -g[1]) / DEG;
      let err = desired - this.yawDeg;
      while (err > 180) err -= 360;
      while (err < -180) err += 360;
      turn += -Math.max(-1, Math.min(1, err / 50)) * hazard * (ROW.GUARD_YAW_DPS / ROW.YAW_DPS_PER_UNIT);
      // soft inward push (water that pushes back, not a wall)
      this.x += g[0] * ROW.GUARD_PUSH * hazard * dtS * dtS * 60;
      this.z += g[1] * ROW.GUARD_PUSH * hazard * dtS * dtS * 60;
      if (hazard > 0.4) this.guardCoach = 1.2;
    }
    this.turnSmooth += (turn - this.turnSmooth) * Math.min(1, dtS * ROW.TURN_SMOOTH);
    const way = 0.12 + 0.88 * Math.min(1, this.speed / (ROW.MAX_SPEED * 0.55));
    this.yawDeg -= this.turnSmooth * ROW.YAW_DPS_PER_UNIT * way * dtS;
    while (this.yawDeg > 180) this.yawDeg -= 360;
    while (this.yawDeg < -180) this.yawDeg += 360;

    // --- integrate ---------------------------------------------------------
    const a = this.yawDeg * DEG;
    const fx = Math.sin(a);
    const fz = -Math.cos(a);
    const nx = this.x + fx * this.speed * dtS;
    const nz = this.z + fz * this.speed * dtS;
    // never leave water: the guard should prevent this; as a last resort
    // the bow slides along the shore (position keeps, motion tangent)
    if (world.inWater(nx, nz) && world.waterDepth(nx, nz) > ROW.MIN_DEPTH_M * 0.5) {
      this.x = nx;
      this.z = nz;
      this.traveled += this.speed * dtS;
    } else {
      this.speed *= 0.9;
    }

    // --- visuals -------------------------------------------------------------
    const bobY = world.seaLevel + 0.05 + Math.sin(timeS * 1.3) * 0.05;
    this.rig.root.position.set(this.x, bobY, this.z);
    this.rig.root.rotation.y = -a;
    this.rig.animate(dtS, this.speed / ROW.MAX_SPEED, timeS);

    // camera: low chase
    const dist = 13;
    const target = new THREE.Vector3(this.x - fx * dist, bobY + 4.6, this.z - fz * dist);
    const k = 1 - Math.exp(-dtS * 3.0);
    if (this.camPos.lengthSq() === 0) this.camPos.copy(target);
    this.camPos.lerp(target, k);
    const camFloor = Math.max(world.groundY(this.camPos.x, this.camPos.z), world.seaLevel) + 1.6;
    if (this.camPos.y < camFloor) this.camPos.y = camFloor;
    this.ctx.camera.position.copy(this.camPos);
    this.ctx.camera.lookAt(this.x + fx * 14, bobY + 1, this.z + fz * 14);

    this.minimap.update(this.x, this.z, this.yawDeg);
    this.updateChrome(dtS);
  }

  private camPos = new THREE.Vector3();

  private updateChrome(dtS: number): void {
    const d = this.controls.debugState();
    const status = d.reason === 'keyboard' ? 'KEYBOARD'
      : d.reason === 'ok' ? (this.controls.cruising ? 'CRUISE' : 'ROWING')
      : d.reason === 'no-signal' ? 'KEYS READY · NO BODY SIGNAL'
      : d.reason.toUpperCase();
    this.ctx.chrome.setStatus(
      `ROW · ${status} · ${this.speed.toFixed(1)} M/S · ` +
      `CADENCE ${Math.round(d.strokeRate * 60)} SPM · ${d.profile.label.toUpperCase()}`,
    );
    if (this.toastLeft > 0) {
      this.toastLeft -= dtS;
      this.ctx.chrome.setCoach('Neutral recaptured.');
    } else if (this.guardCoach > 0) {
      this.guardCoach -= dtS;
      this.ctx.chrome.setCoach('Shallow water — steering out.');
    } else if (d.reason === 'ok' && d.strokeRate < 0.05 && !this.controls.cruising && this.speed < 0.3) {
      this.ctx.chrome.setCoach('Pull with a full arm motion to row.');
    } else {
      this.ctx.chrome.setCoach('');
    }
  }

  state(): Record<string, unknown> {
    const d = this.controls.debugState();
    return {
      x: this.x, z: this.z, yawDeg: this.yawDeg, speed: this.speed,
      traveled: this.traveled, strokes: this.strokesSeen,
      cruising: this.controls.cruising, bodyStatus: d.reason,
      sdf: this.ctx.world.shoreSDF(this.x, this.z),
      inWater: this.ctx.world.inWater(this.x, this.z),
    };
  }

  teleport(x: number, z: number, yawDeg: number, speed?: number): void {
    this.x = x; this.z = z; this.yawDeg = yawDeg;
    if (speed !== undefined) this.speed = speed;
  }

  dispose(): void {
    this.controls.dispose();
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('keyup', this.onKeyUp);
    this.ctx.scene.remove(this.rig.root);
    this.minimap.dispose();
  }
}
