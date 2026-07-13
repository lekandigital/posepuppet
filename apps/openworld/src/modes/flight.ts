// Region flight — the completed TinySkies control stack over the baked
// fjord. REUSED UNCHANGED: BodyFlightControls (profiles/assists/boost/
// autopilot/recenter/keyboard-priority — the Gate-2/3-approved feel) and
// FlightControls (keyboard ControlState). Owned here: plane dynamics in
// metres over real terrain, ground safety, region-edge soft turn-back,
// airfield takeoff, chase camera, placeholder plane articulation.

import * as THREE from 'three';
import { BodyFlightControls } from '@flight-input/bodyControls';
import { FlightControls, type ControlState } from '@flight-game/FlightControls';
import type { GameMode, ModeContext } from './types';
import { createPlaceholderPlane, type PlaneRig } from '../vehicles/placeholderPlane';

/** Arcade feel constants for a 4.5×4 km region (metres, seconds). */
export const FLY = {
  MIN_SPEED: 18,
  CRUISE: 42,
  MAX_SPEED: 65,
  BOOST_SPEED: 92,
  BOOST_S: 1.7,          // TinySkies boost duration, kept
  ACCEL: 14,
  DECEL: 18,
  YAW_DPS_PER_UNIT: 42,  // yawRate = turnRate(≤1.2 kb, ≤0.95 assist) × this
  CLIMB_MPS: 16,
  MAX_BANK: Math.PI / 4, // TinySkies MAX_BANK kept
  BANK_RESP: 4,          // TinySkies BANK_RESPONSIVENESS kept
  MIN_AGL: 4,
  CEILING: 1400,
  // containment: soft turn-back band at the region edge — never a wall
  EDGE_BAND_M: 650,
  EDGE_YAW_DPS: 60,
  // takeoff
  VR: 26,                // rotate speed
  TAKEOFF_THROTTLE_S: 2.2,
} as const;

const DEG = Math.PI / 180;

export class FlightMode implements GameMode {
  readonly id = 'flight';
  readonly body: BodyFlightControls;
  private kb: FlightControls;
  private rig: PlaneRig;
  private ctx: ModeContext;

  // sim state (scene metres; yawDeg compass — 0 north/−Z)
  x = 0; y = 0; z = 0;
  yawDeg = 0;
  speed = 0;
  private vRate = 0;
  private bank = 0;
  private pitchVis = 0;
  private boostLeft = 0;
  private airborne = false;
  private throttleTimer = 0;
  private turnSmooth = 0;
  private elevSmooth = 0;
  private descendKey = false;
  private edgeCoach = 0;
  private toastLeft = 0;

  constructor(ctx: ModeContext) {
    this.ctx = ctx;
    this.body = new BodyFlightControls();
    this.kb = new FlightControls(ctx.scene.userData.container ?? document.body);
    this.rig = createPlaceholderPlane();
    ctx.scene.add(this.rig.root);
    // keyboard descend: TinySkies never needed one (terrain hugging); a
    // region plane does. Game-side listener — the reused module stays put.
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKeyUp);
  }

  private onKey = (e: KeyboardEvent): void => {
    if (e.key === 'ArrowDown') { this.descendKey = true; e.preventDefault(); }
  };
  private onKeyUp = (e: KeyboardEvent): void => {
    if (e.key === 'ArrowDown') this.descendKey = false;
  };

  enter(): void {
    const spawn = this.ctx.world.spawn('airfield');
    this.x = spawn.x;
    this.z = spawn.z;
    // runway headings are bidirectional — depart toward the region centre
    const { minX, maxX, minZ, maxZ } = this.ctx.world.bounds;
    const a = spawn.yawDeg * DEG;
    const toCx = (minX + maxX) / 2 - spawn.x;
    const toCz = (minZ + maxZ) / 2 - spawn.z;
    this.yawDeg = Math.sin(a) * toCx - Math.cos(a) * toCz >= 0 ? spawn.yawDeg : spawn.yawDeg + 180;
    this.y = this.ctx.world.groundY(this.x, this.z) + 1.6;
    this.speed = 0;
    this.airborne = false;
    this.throttleTimer = 0;
    this.ctx.chrome.setMode('flight');
    this.ctx.chrome.setCoach('Rolling — steer when airborne. Arms out to fly; A/D + arrows on keys.');
    // camera starts behind the plane
    this.placeCamera(1);
  }

  /** heading forward vector (scene) */
  private fwd(): [number, number] {
    const a = this.yawDeg * DEG;
    return [Math.sin(a), -Math.cos(a)];
  }

  update(dtS: number, _timeS: number): void {
    const world = this.ctx.world;
    const merged = this.body.merge(this.kb.getState()) as ControlState & { boost?: boolean };

    // --- speed -----------------------------------------------------------
    let targetSpeed: number;
    if (!this.airborne) {
      // scripted throttle-up along the runway; rotate at VR
      this.throttleTimer += dtS;
      targetSpeed = this.throttleTimer > 0.6 ? FLY.CRUISE : 0;
      if (this.speed >= FLY.VR) this.airborne = true;
    } else if (merged.speedAxis !== undefined) {
      const a = merged.speedAxis; // −1..1 → MIN..MAX
      targetSpeed = a >= 0
        ? FLY.CRUISE + (FLY.MAX_SPEED - FLY.CRUISE) * a
        : FLY.CRUISE + (FLY.CRUISE - FLY.MIN_SPEED) * a;
    } else if (merged.forward) targetSpeed = FLY.MAX_SPEED;
    else if (merged.brake) targetSpeed = FLY.MIN_SPEED;
    else targetSpeed = FLY.CRUISE;

    if (merged.boost && this.airborne) this.boostLeft = FLY.BOOST_S;
    if (this.boostLeft > 0) {
      this.boostLeft -= dtS;
      targetSpeed = FLY.BOOST_SPEED;
    }
    const rate = targetSpeed > this.speed ? FLY.ACCEL : FLY.DECEL;
    this.speed += Math.max(-rate * dtS, Math.min(rate * dtS, targetSpeed - this.speed));

    // --- heading (yaw) + containment --------------------------------------
    let turn = merged.turnRate; // + = left (keyboard A), body pre-clamped
    // region-edge soft turn-back: steer toward the region centre with
    // authority growing as the edge nears; blends WITH player input
    const edge = world.edgeDistance(this.x, this.z);
    let edgeAssist = 0;
    if (this.airborne && edge < FLY.EDGE_BAND_M) {
      const { minX, maxX, minZ, maxZ } = world.bounds;
      const toCx = (minX + maxX) / 2 - this.x;
      const toCz = (minZ + maxZ) / 2 - this.z;
      const desired = Math.atan2(toCx, -toCz) / DEG;
      let err = desired - this.yawDeg;
      while (err > 180) err -= 360;
      while (err < -180) err += 360;
      const gain = Math.pow(1 - Math.max(0, edge) / FLY.EDGE_BAND_M, 1.5); // 0..1, steepens at the edge
      edgeAssist = -Math.max(-1, Math.min(1, err / 40)) * gain * (FLY.EDGE_YAW_DPS / FLY.YAW_DPS_PER_UNIT);
      this.edgeCoach = 1.2;
    }
    turn += edgeAssist;
    // input smoothing (TinySkies TURN_INPUT_SMOOTH feel)
    this.turnSmooth += (turn - this.turnSmooth) * Math.min(1, dtS * 8);
    if (this.airborne) {
      const speedFactor = 0.55 + 0.45 * Math.min(1, this.speed / FLY.CRUISE);
      this.yawDeg -= this.turnSmooth * FLY.YAW_DPS_PER_UNIT * speedFactor * dtS;
      while (this.yawDeg > 180) this.yawDeg -= 360;
      while (this.yawDeg < -180) this.yawDeg += 360;
    }

    // --- vertical ---------------------------------------------------------
    let elev = 0;
    if (merged.elevateAxis !== undefined) elev = merged.elevateAxis;
    else if (merged.elevate) elev = 0.8;
    if (this.descendKey) elev = Math.min(elev, -0.8);
    this.elevSmooth += (elev - this.elevSmooth) * Math.min(1, dtS * 6);
    if (this.airborne) {
      this.vRate = this.elevSmooth * FLY.CLIMB_MPS;
      // gentle climb-out until the player asks otherwise
      if (!merged.elevate && merged.elevateAxis === undefined && !this.descendKey && this.y < 60) {
        this.vRate = Math.max(this.vRate, 5);
      }
    } else {
      this.vRate = 0;
    }

    // --- integrate ---------------------------------------------------------
    const [fx, fz] = this.fwd();
    this.x += fx * this.speed * dtS;
    this.z += fz * this.speed * dtS;
    this.y += this.vRate * dtS;

    // ground/sea safety: soft floor, never a crash state
    const floor = Math.max(world.groundY(this.x, this.z), world.seaLevel) + (this.airborne ? FLY.MIN_AGL : -2.4);
    if (this.y < floor) {
      this.y = floor;
      if (this.vRate < 0) this.vRate = 0;
    }
    if (this.y > FLY.CEILING) this.y = FLY.CEILING;

    // --- visuals ------------------------------------------------------------
    const targetBank = this.airborne ? Math.max(-1, Math.min(1, this.turnSmooth)) * FLY.MAX_BANK : 0;
    this.bank += (targetBank - this.bank) * Math.min(1, dtS * FLY.BANK_RESP);
    const targetPitch = this.airborne ? Math.max(-0.5, Math.min(0.5, (this.vRate / FLY.CLIMB_MPS) * 0.45)) : 0;
    this.pitchVis += (targetPitch - this.pitchVis) * Math.min(1, dtS * 4);

    this.rig.root.position.set(this.x, this.y, this.z);
    this.rig.root.rotation.set(this.pitchVis, -this.yawDeg * DEG, this.bank, 'YXZ');
    const agl = this.y - this.ctx.world.groundY(this.x, this.z);
    this.rig.root.getObjectByName('gear')!.visible = agl < 40;
    const throttle01 = Math.min(1, this.speed / FLY.MAX_SPEED);
    this.rig.animate(dtS, throttle01, -this.turnSmooth, -this.elevSmooth, -this.turnSmooth * 0.5);

    this.placeCamera(dtS);
    this.updateChrome(dtS);
  }

  private camPos = new THREE.Vector3();
  private placeCamera(dtS: number): void {
    const [fx, fz] = this.fwd();
    const dist = 26;
    const target = new THREE.Vector3(
      this.x - fx * dist,
      this.y + 9,
      this.z - fz * dist,
    );
    const k = 1 - Math.exp(-dtS * 3.2);
    if (this.camPos.lengthSq() === 0) this.camPos.copy(target);
    this.camPos.lerp(target, k);
    // keep the camera out of the terrain
    const camFloor = this.ctx.world.groundY(this.camPos.x, this.camPos.z) + 3;
    if (this.camPos.y < camFloor) this.camPos.y = camFloor;
    this.ctx.camera.position.copy(this.camPos);
    this.ctx.camera.lookAt(this.x + fx * 30, this.y, this.z + fz * 30);
  }

  private updateChrome(dtS: number): void {
    const d = this.body.debugState();
    if (this.body.consumeRecenterFlag()) this.toastLeft = 2.5;
    const status = d.reason === 'keyboard' ? 'KEYBOARD'
      : d.reason === 'ok' ? `BODY · ${d.profile.label.toUpperCase()}`
      : d.reason === 'no-signal' ? 'KEYS READY · NO BODY SIGNAL'
      : d.reason.toUpperCase();
    this.ctx.chrome.setStatus(
      `FLIGHT · ${Math.round(this.speed * 3.6)} KM/H · ALT ${Math.round(this.y)} M · ` +
      `HDG ${Math.round((this.yawDeg + 360) % 360)}° · ${status}`,
    );
    if (this.toastLeft > 0) {
      this.toastLeft -= dtS;
      this.ctx.chrome.setCoach('Neutral recaptured.');
    } else if (this.edgeCoach > 0) {
      this.edgeCoach -= dtS;
      this.ctx.chrome.setCoach('Region edge — turning back.');
    } else if (!this.airborne) {
      this.ctx.chrome.setCoach('Rolling — rotate at speed. Arms out to fly; A/D + arrows on keys.');
    } else {
      this.ctx.chrome.setCoach('');
    }
  }

  /** Eval surface for specs. */
  state(): Record<string, number | boolean | string> {
    return {
      x: this.x, y: this.y, z: this.z, yawDeg: this.yawDeg, speed: this.speed,
      airborne: this.airborne, bodyStatus: this.body.debugState().reason,
      edgeDistance: this.ctx.world.edgeDistance(this.x, this.z),
    };
  }

  /** Test hook: reposition mid-air (containment spec). */
  teleport(x: number, z: number, yawDeg: number, y?: number): void {
    this.x = x; this.z = z; this.yawDeg = yawDeg;
    this.y = y ?? Math.max(this.ctx.world.groundY(x, z), this.ctx.world.seaLevel) + 120;
    this.airborne = true;
    this.speed = FLY.CRUISE;
  }

  dispose(): void {
    this.kb.dispose();
    this.body.dispose();
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('keyup', this.onKeyUp);
    this.ctx.scene.remove(this.rig.root);
  }
}
