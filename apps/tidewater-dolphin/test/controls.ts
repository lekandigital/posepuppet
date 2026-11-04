// CP10 controls pass — headless scenario tests for the INPUT LAYER. The production listeners in
// src/input/swimControls.ts are driven with synthetic keyboard / mouse / gamepad / body-signal
// events through the real 120 Hz sim and the real chase rig, paced like the game loop (60 Hz
// polls, 16.67 ms, two sim steps per poll). No GPU, no DOM: a minimal fake window and a
// controllable clock. These are action sequences (hold, tap, release, switch device), not
// direct state manipulation.
//   npx tsx test/controls.ts

// CPU-only stubs for the vendored engine (as test/unit.ts)
(globalThis as unknown as { GPUBufferUsage: unknown }).GPUBufferUsage = { STORAGE: 1, COPY_DST: 2, COPY_SRC: 4, VERTEX: 8, INDEX: 16, INDIRECT: 32, UNIFORM: 64 };

import { SwimSim, SIM, NEUTRAL_INTENT, type SwimIntent } from '../src/dolphin/sim';
import { CameraRig } from '../src/dolphin/cameraRig';
import { createSwimControls, PAD, type ControlsWindow, type SwimControls, type CameraInput } from '../src/input/swimControls';
import { PerspectiveCamera, Vector3 } from '../vendor/tidewater/src/engine/index.js';

let failed = 0;
const check = (name: string, ok: boolean, detail?: unknown) => {
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail !== undefined ? ' — ' + JSON.stringify(detail) : ''}`);
};
const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps;
const r2 = (v: number) => +v.toFixed(2);

// ---------------------------------------------------------------- controllable clock
let now = 0;
const perf = globalThis.performance as unknown as { now: () => number };
const realNow = perf.now.bind(globalThis.performance);
perf.now = () => now;

// ---------------------------------------------------------------- fake window + events
type Listener = (e: unknown) => void;
function fakeWindow() {
  const ls = new Map<string, Set<Listener>>();
  const w = {
    pads: [] as (Gamepad | null)[],
    navigator: { getGamepads: () => w.pads },
    addEventListener(type: string, cb: Listener) { if (!ls.has(type)) ls.set(type, new Set()); ls.get(type)!.add(cb); },
    removeEventListener(type: string, cb: Listener) { ls.get(type)?.delete(cb); },
    dispatch(type: string, e: Record<string, unknown> = {}) { for (const cb of [...(ls.get(type) ?? [])]) cb(e); },
    listenerCount: () => [...ls.values()].reduce((n, s) => n + s.size, 0),
  };
  return w;
}
const KEYS: Record<string, { code: string; key: string }> = {
  Space: { code: 'Space', key: ' ' }, Shift: { code: 'ShiftLeft', key: 'Shift' }, W: { code: 'KeyW', key: 'w' }, A: { code: 'KeyA', key: 'a' },
  S: { code: 'KeyS', key: 's' }, D: { code: 'KeyD', key: 'd' }, X: { code: 'KeyX', key: 'x' }, Q: { code: 'KeyQ', key: 'q' }, E: { code: 'KeyE', key: 'e' },
  R: { code: 'KeyR', key: 'r' }, V: { code: 'KeyV', key: 'v' }, Ctrl: { code: 'ControlLeft', key: 'Control' }, Z: { code: 'KeyZ', key: 'z' },
};
function kev(name: string, extra: Record<string, unknown> = {}) {
  const k = KEYS[name]!;
  const e = { code: k.code, key: k.key, target: null as unknown, ctrlKey: false, metaKey: false, altKey: false, repeat: false, prevented: false, preventDefault() { e.prevented = true; }, ...extra };
  return e;
}
function makePad() {
  const buttons = Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 }));
  const pad = { id: 'Fake Standard Pad (STANDARD GAMEPAD)', index: 0, connected: true, mapping: 'standard', timestamp: 0, axes: [0, 0, 0, 0], buttons, vibrationActuator: null, hapticActuators: [] };
  return {
    pad: pad as unknown as Gamepad,
    press(i: number, value = 1) { buttons[i]!.pressed = value > 0.05; buttons[i]!.touched = true; buttons[i]!.value = value; },
    release(i: number) { buttons[i]!.pressed = false; buttons[i]!.value = 0; },
    axis(i: number, v: number) { pad.axes[i] = v; },
    neutral() { for (let i = 0; i < 17; i++) this.release(i); pad.axes = [0, 0, 0, 0]; },
  };
}
const ENVELOPE = 'bodyarcade.body-input.v1';
function bodySignal(ts: number, count: number, over: Partial<{ leanX: number; leanY: number; crouch: number; handsForward: number; confidence: number }> = {}) {
  return {
    v: 1, ts, confidence: over.confidence ?? 0.9, seated: false, stillness: 0, neutralConfidence: 1,
    axes: { leanX: over.leanX ?? 0, leanY: over.leanY ?? 0, crouch: over.crouch ?? 0, tallness: 0, armsOut: 0, armsRaised: 0, handsForward: over.handsForward ?? 0, handPoint: 0 },
    events: [] as string[],
    swim: { active: true, count, rate: 1.6, phase: 0, amp: 0.8 },
  };
}

// ---------------------------------------------------------------- the game loop (dolphinPlayer.update, distilled)
const FRAME_MS = 1000 / 60;
const OPEN_WORLD = { inWater: () => true, shoreDistance: () => 500, depthAt: () => 12, containmentBand: 12 };
const OPEN_COLLISION = { resolve: (_f: unknown, to: Vector3) => ({ pos: to.clone(), obstructed: false }), clampPoint: (p: Vector3) => p, losClear: () => true };

function makeWorld() {
  const w = fakeWindow();
  const hooks = { menu: 0, help: 0, cycle: 0, recenter: 0 };
  const controls: SwimControls = createSwimControls(w as unknown as ControlsWindow, {
    onMenu: () => hooks.menu++, onHelp: () => hooks.help++, onCycleCamera: () => hooks.cycle++, onRecenter: () => hooks.recenter++,
  });
  const sim = new SwimSim(OPEN_WORLD as never);
  sim.state.y = -2.5; sim.state.speed = 2; sim.state.wvx = 0; sim.state.wvz = 2;
  const rig = new CameraRig(new PerspectiveCamera(55, 16 / 9, 0.1, 60000) as never, OPEN_COLLISION as never, { terrainCompression: true });
  let acc = 0;
  let lastIntent: SwimIntent = { ...NEUTRAL_INTENT };
  let lastLook: CameraInput = { lookYaw: 0, lookPitch: 0, recenter: false, cycleStyle: false };
  const frame = (n = 1, onFrame?: (intent: SwimIntent, look: CameraInput) => void): SwimIntent => {
    for (let i = 0; i < n; i++) {
      now += FRAME_MS;
      const intent = controls.intent(FRAME_MS);
      const look = controls.cameraInput(FRAME_MS / 1000);
      acc += FRAME_MS / 1000;
      let kicks = intent.kicks;
      while (acc >= SIM.DT - 1e-9) { sim.step({ ...intent, kicks }); kicks = 0; acc -= SIM.DT; }
      if (look.lookYaw || look.lookPitch) rig.addLook(look.lookYaw, look.lookPitch);
      if (look.recenter) rig.recenter();
      rig.update(sim.state, FRAME_MS / 1000, { bodyY: sim.state.y, steer: Math.max(Math.abs(intent.pitch), Math.abs(intent.roll)) });
      lastIntent = intent; lastLook = look;
      onFrame?.(intent, look);
    }
    return lastIntent;
  };
  const seconds = (s: number, onFrame?: (intent: SwimIntent, look: CameraInput) => void) => frame(Math.round(s * 60), onFrame);
  const key = {
    down: (name: string, extra: Record<string, unknown> = {}) => { const e = kev(name, extra); w.dispatch('keydown', e); return e; },
    up: (name: string) => w.dispatch('keyup', kev(name)),
    tap: (name: string) => { key.down(name); frame(1); key.up(name); },
  };
  const mouse = {
    drag(dx: number, dy: number, frames = 5, target: { tagName: string } = { tagName: 'CANVAS' }, button = 0) {
      w.dispatch('mousedown', { button, buttons: button === 2 ? 2 : 1, target });
      for (let i = 0; i < frames; i++) { w.dispatch('mousemove', { buttons: button === 2 ? 2 : 1, movementX: dx / frames, movementY: dy / frames }); frame(1); }
      w.dispatch('mouseup', { button, buttons: 0 });
    },
  };
  const digest = () => { const s = sim.state; return `${s.x.toFixed(6)},${s.y.toFixed(6)},${s.z.toFixed(6)},${s.yaw.toFixed(6)},${s.pitch.toFixed(6)},${s.speed.toFixed(6)},${s.kickCount},${s.breachCount}`; };
  return {
    w, controls, sim, rig, frame, seconds, key, mouse, hooks, digest,
    get intent() { return lastIntent; },
    get look() { return lastLook; },
    hud: () => controls.hudState(),
    dispose() { controls.dispose(); },
  };
}

// ================================================================ scenarios
// 1. fresh session: keyboard only, nothing pressed → a level glide, no autopilot, no stuck anything
{
  const W = makeWorld();
  const i0 = W.frame(1);
  const h = W.hud();
  check('fresh: keyboard is the source with no webcam and no pad (tracking "keyboard", not "none" / autopilot)', h.source === 'keyboard' && h.tracking === 'keyboard' && !i0.autopilot, { source: h.source, tracking: h.tracking });
  check('fresh: neutral intent (no swim, no kicks, level)', i0.swim === 0 && i0.kicks === 0 && i0.pitch === 0 && i0.roll === 0 && !i0.burst && !i0.brake);
  const v0 = W.sim.state.speed; W.seconds(2);
  check('fresh: the dolphin glides (speed decays smoothly from the spawn glide)', W.sim.state.speed < v0 && W.sim.state.speed > 1, r2(W.sim.state.speed));
  check('fresh: listeners installed (keyboard, mouse, blur, message)', W.w.listenerCount() >= 7, W.w.listenerCount());
  W.dispose();
  check('dispose removes every listener', W.w.listenerCount() === 0, W.w.listenerCount());
}

// 2. hold Space → cruise; release → glide (smooth, no step)
{
  const W = makeWorld();
  W.seconds(1);
  W.key.down('Space');
  const first = W.frame(1);
  check('Space press: the press itself is one tail stroke (kicks 1) and the hold begins (swim 1)', first.kicks === 1 && first.swim === 1 && first.kickRate > 1.5, { kicks: first.kicks, swim: first.swim, kickRate: first.kickRate });
  let kicksWhileHeld = 0;
  W.seconds(2, (i) => { kicksWhileHeld += i.kicks; });
  check('holding Space adds no further impulses (smooth thrust), reaches cruise within 2 s', kicksWhileHeld === 0 && W.sim.state.speed > 4.8, { kicks: kicksWhileHeld, speed: r2(W.sim.state.speed) });
  check('HUD: swimLevel 1, source keyboard', W.hud().swimLevel === 1 && W.hud().source === 'keyboard');
  W.key.up('Space');
  let maxDrop = 0; let prev = W.sim.state.speed; let rises = 0;
  W.seconds(3, () => { const v = W.sim.state.speed; maxDrop = Math.max(maxDrop, prev - v); if (v > prev + 1e-9) rises++; prev = v; });
  check('release → glide: monotone, no per-frame drop > 0.1 m/s, ~3 m/s after 3 s', rises === 0 && maxDrop < 0.1 && W.sim.state.speed > 2.6 && W.sim.state.speed < 3.4, { maxDrop: +maxDrop.toFixed(3), speed: r2(W.sim.state.speed) });
  check('release: swim 0, kickRate 0 (tail animation idles)', W.intent.swim === 0 && W.intent.kickRate === 0);
  W.dispose();
}

// 3. taps: one impulse per press, auto-repeat never doubles it
{
  const W = makeWorld();
  W.seconds(2); const v0 = W.sim.state.speed;
  W.key.down('Space'); W.key.down('Space'); W.key.down('Space'); // OS auto-repeat
  const i = W.frame(1);
  check('a held key auto-repeating adds exactly one stroke', i.kicks === 1, i.kicks);
  W.key.up('Space');
  let peak = 0; W.seconds(1, () => { peak = Math.max(peak, W.sim.state.speed); });
  check('a Space tap lunges (speed up ≥ 0.5 m/s within 1 s) then glides', peak - v0 > 0.5 && W.sim.state.speed < peak, { v0: r2(v0), peak: r2(peak), after: r2(W.sim.state.speed) });
  W.dispose();
}

// 4. turning: A/D bank-turn with a keyboard ramp; D turns right (yaw +), A turns left
{
  const W = makeWorld();
  W.key.down('Space'); W.seconds(1.5);
  const yaw0 = W.sim.state.yaw;
  W.key.down('D');
  const i1 = W.frame(1);
  check('keyboard ramp: one frame of D is a nudge (|roll| < 0.2), not full deflection', Math.abs(i1.roll) < 0.2 && i1.roll > 0, i1.roll);
  W.seconds(0.3);
  check('…and full deflection within 0.3 s', near(W.intent.roll, 1), W.intent.roll);
  W.seconds(1);
  check('D: banks right and turns right (roll > 0.5 rad, yaw increased ≥ 60° in 1.3 s at cruise)', W.sim.state.roll > 0.5 && W.sim.state.yaw - yaw0 > 1.05, { roll: r2(W.sim.state.roll), dyaw: r2((W.sim.state.yaw - yaw0) * 180 / Math.PI) });
  W.key.up('D');
  W.frame(6);
  check('release D: the axis falls back to 0 within 0.1 s', W.intent.roll === 0);
  W.seconds(1.2); // the bank unwinds (BANK_TAU 0.3 s, slew-limited) before the opposite turn
  const yaw1 = W.sim.state.yaw; W.key.down('A'); W.seconds(1.3); W.key.up('A');
  check('A: turns left (yaw decreased ≥ 60° in 1.3 s), roll negative', W.sim.state.yaw < yaw1 - 1.05 && W.sim.state.roll < -0.5, { dyaw: r2((W.sim.state.yaw - yaw1) * 180 / Math.PI), roll: r2(W.sim.state.roll) });
  W.dispose();
}

// 5. dive and climb; invert vertical
{
  const W = makeWorld();
  W.key.down('Space'); W.seconds(1);
  const y0 = W.sim.state.y; W.key.down('W'); W.seconds(1);
  check('W: nose down (pitch > 0.5 rad) and the dolphin dives > 1 m in 1 s', W.sim.state.pitch > 0.5 && y0 - W.sim.state.y > 1, { pitch: r2(W.sim.state.pitch), dived: r2(y0 - W.sim.state.y) });
  W.key.up('W'); W.seconds(1.5);
  check('release W: full assist levels the dolphin again within 1.5 s (from a 77° dive)', Math.abs(W.sim.state.pitch) < 0.1, r2(W.sim.state.pitch));
  const y1 = W.sim.state.y; W.key.down('S'); W.seconds(0.8); W.key.up('S');
  check('S: nose up and climbing', W.sim.state.pitch < -0.4 && W.sim.state.y > y1, { pitch: r2(W.sim.state.pitch), climbed: r2(W.sim.state.y - y1) });
  W.seconds(1.5);
  W.controls.setPrefs({ invertY: true });
  W.key.down('W'); W.seconds(0.5); W.key.up('W');
  check('Invert vertical: W noses up', W.intent.pitch <= 0 && W.sim.state.pitch < -0.2, r2(W.sim.state.pitch));
  W.dispose();
}

// 6. charge (Shift) and its release — eases back, never a wall
{
  const W = makeWorld();
  W.key.down('Space'); W.seconds(1.5);
  W.key.down('Shift'); W.seconds(2);
  check('Shift: charge reaches ≥ 8.8 m/s within 2 s (intent.burst)', W.intent.burst && W.sim.state.speed >= 8.8, r2(W.sim.state.speed));
  W.key.up('Shift');
  let maxDrop = 0; let prev = W.sim.state.speed; let v05 = 0;
  W.seconds(3, () => { const v = W.sim.state.speed; maxDrop = Math.max(maxDrop, prev - v); prev = v; });
  W.seconds(0);
  check('charge released (still swimming): no per-frame drop > 0.15 m/s, back at cruise ± 0.1 after 3 s', maxDrop < 0.15 && near(W.sim.state.speed, 5, 0.1), { maxDrop: +maxDrop.toFixed(3), speed: r2(W.sim.state.speed) });
  void v05;
  W.dispose();
}

// 7. brake
{
  const W = makeWorld();
  W.key.down('Space'); W.seconds(2);
  W.key.down('X'); let v03 = 0;
  W.seconds(1, (i) => { if (!i.brake) failed++; });
  W.seconds(0);
  v03 = W.sim.state.speed;
  check('X while Space is held: brake wins over thrust — under 0.5 m/s within 1 s', W.intent.brake && v03 < 0.5, r2(v03));
  W.key.up('X'); W.seconds(3);
  check('release X (Space still held): swims again', W.sim.state.speed > 4, r2(W.sim.state.speed));
  W.key.up('Space'); W.key.down('X'); W.seconds(1.5); W.key.up('X'); W.seconds(3);
  check('after a full stop, full assist creeps forward (drift vs glide drag settles ≈ 0.3 m/s), never strands', W.sim.state.speed > 0.2 && W.sim.state.speed < 0.5, r2(W.sim.state.speed));
  W.dispose();
}

// 8. breach and re-entry from keyboard input alone
{
  const W = makeWorld();
  W.key.down('Space'); W.seconds(2);
  W.key.down('S');
  let air = false; let tAir = -1; let t = 0; let apex = -99;
  W.seconds(3, () => { t += 1 / 60; if (W.sim.state.phase === 'air') { if (!air) tAir = t; air = true; } apex = Math.max(apex, W.sim.state.y); });
  check('cruise + hold S: the dolphin breaches within 3 s (phase air, apex above the surface)', air && tAir < 3 && apex > 0.2, { tAir: r2(tAir), apex: r2(apex), breaches: W.sim.state.breachCount });
  W.key.up('S');
  let reentered = false; let maxDrop = 0; let prev = -1;
  W.seconds(3, () => { if (W.sim.state.phase === 'swim' && air) { if (reentered && prev >= 0) maxDrop = Math.max(maxDrop, prev - W.sim.state.speed); reentered = true; prev = W.sim.state.speed; } });
  check('re-entry: back to swim; the re-entry speed bleeds (no per-frame drop > 0.3 m/s after the splash)', reentered && W.sim.state.phase === 'swim' && maxDrop < 0.3, { maxDrop: +maxDrop.toFixed(3), speed: r2(W.sim.state.speed), breaches: W.sim.state.breachCount });
  W.dispose();
}

// 9. utility keys: R / V act once per press and never count as control input
{
  const W = makeWorld();
  W.key.down('R'); const a = W.frame(1); W.key.up('R');
  check('R → one recenter flag + hook', W.look.recenter && W.hooks.recenter === 1 && a.swim === 0);
  W.frame(1);
  check('…consumed after one frame', !W.look.recenter);
  W.key.down('V'); W.frame(1); W.key.up('V');
  check('V → one camera-style cycle + hook', W.look.cycleStyle && W.hooks.cycle === 1);
  // utility keys must not steal the dolphin from a pad
  const P = makePad(); W.w.pads = [P.pad]; P.axis(0, 0.9); W.seconds(0.5);
  check('pad stick held → gamepad owns the dolphin', W.hud().source === 'gamepad');
  W.key.down('V'); W.frame(2); W.key.up('V'); W.key.down('R'); W.frame(2); W.key.up('R');
  check('pressing V / R on the keyboard while the pad steers does NOT take control away from the pad', W.hud().source === 'gamepad' && W.hooks.cycle === 2 && W.hooks.recenter === 2, W.hud().source);
  W.dispose();
}

// 10. gamepad: analog swim on RT, A, charge, brake, steer, look, utility buttons
{
  const W = makeWorld();
  const P = makePad(); W.w.pads = [P.pad];
  W.frame(1);
  check('pad connected and idle: keyboard still the owner (no body seen), pad reported connected', W.hud().padConnected && W.hud().source === 'keyboard', W.hud());
  P.press(PAD.RT, 1);
  const first = W.frame(1);
  check('RT press: gamepad owns the dolphin, one stroke, swim 1', W.hud().source === 'gamepad' && W.hud().tracking === 'gamepad' && first.kicks === 1 && first.swim === 1, { kicks: first.kicks, swim: first.swim });
  W.seconds(2);
  check('RT held: cruise within 2 s', W.sim.state.speed > 4.8, r2(W.sim.state.speed));
  P.press(PAD.RT, 0.4); W.seconds(6);
  const want = SIM.MAX_SPEED * (SIM.SWIM_MIN_FRAC + (1 - SIM.SWIM_MIN_FRAC) * (0.4 - 0.08) / 0.92);
  check('RT at 40 %: sustained speed follows the trigger (≈ 3.0 m/s)', near(W.sim.state.speed, want, 0.15) && W.intent.swim < 0.5 && W.intent.swim > 0.2, { speed: r2(W.sim.state.speed), want: r2(want), level: r2(W.intent.swim) });
  P.release(PAD.RT); P.press(PAD.A); W.frame(2);
  check('A also swims (swim 1)', W.intent.swim === 1);
  P.press(PAD.LB); W.frame(1); check('LB charges', W.intent.burst); P.release(PAD.LB);
  P.press(PAD.B); W.frame(1); check('B charges', W.intent.burst); P.release(PAD.B);
  P.press(PAD.LT); W.frame(1); check('LT brakes', W.intent.brake); P.release(PAD.LT);
  P.press(PAD.X); W.frame(1); check('X brakes', W.intent.brake); P.release(PAD.X);
  W.frame(1);
  check('bumpers / triggers released: no stuck charge or brake', !W.intent.burst && !W.intent.brake);
  const yaw0 = W.sim.state.yaw; P.axis(0, 1); W.seconds(1);
  check('left stick right: full roll (squared curve reaches 1 at the rim), turns right', near(W.intent.roll, 1, 1e-6) && W.sim.state.yaw > yaw0 + 0.6, { roll: W.intent.roll, dyaw: r2(W.sim.state.yaw - yaw0) });
  P.axis(0, 0.3); W.frame(1);
  check('left stick 30 %: squared response ≈ 0.03 (precise near centre)', W.intent.roll > 0.01 && W.intent.roll < 0.06, W.intent.roll);
  P.axis(0, 0.1); W.frame(1); check('inside the 16 % deadzone → 0', W.intent.roll === 0);
  P.axis(0, 0); P.axis(1, -1); W.seconds(0.5);
  check('stick forward noses DOWN (dive), like W', W.intent.pitch > 0.9 && W.sim.state.pitch > 0.3, { pitch: W.intent.pitch, simPitch: r2(W.sim.state.pitch) });
  P.axis(1, 0); W.seconds(1.5);
  const o0 = W.rig.evalState(W.sim.state).orbitYawRad;
  P.axis(2, 1); W.seconds(0.5); P.axis(2, 0);
  check('right stick looks (orbit yaw moved ≥ 0.3 rad in 0.5 s)', Math.abs(W.rig.evalState(W.sim.state).orbitYawRad - o0) > 0.3, r2(W.rig.evalState(W.sim.state).orbitYawRad));
  P.press(PAD.Y); W.frame(1); P.release(PAD.Y); W.frame(1);
  P.press(PAD.RS); W.frame(1); P.release(PAD.RS); W.frame(1);
  P.press(PAD.START); W.frame(1); P.release(PAD.START); W.frame(1);
  P.press(PAD.BACK); W.frame(1); P.release(PAD.BACK); W.frame(1);
  P.press(PAD.RIGHT); W.frame(1); P.release(PAD.RIGHT); W.frame(1);
  check('Y / D-pad ► cycle the camera, RS click recenters, Start → menu, Back → controls sheet (each once per press)', W.hooks.cycle === 2 && W.hooks.recenter === 1 && W.hooks.menu === 1 && W.hooks.help === 1, W.hooks);
  check('HUD shows the pad id', typeof W.hud().padId === 'string' && W.hud().padId!.includes('Fake'));
  W.dispose();
}

// 11. pad disconnect / reconnect: nothing sticks, no phantom edges
{
  const W = makeWorld();
  const P = makePad(); W.w.pads = [P.pad];
  P.press(PAD.RT, 1); P.press(PAD.LB); W.seconds(1.5);
  check('swimming and charging on the pad', W.intent.swim === 1 && W.intent.burst && W.hud().source === 'gamepad');
  W.w.pads = []; // unplugged mid-hold
  const after = W.frame(1);
  check('unplugged mid-hold: control falls back to the keyboard, swim and charge drop at once, pad reported gone', W.hud().source === 'keyboard' && after.swim === 0 && !after.burst && !W.hud().padConnected);
  let maxDrop = 0; let prev = W.sim.state.speed;
  W.seconds(2, () => { maxDrop = Math.max(maxDrop, prev - W.sim.state.speed); prev = W.sim.state.speed; });
  check('…and the dolphin glides down smoothly (no step)', maxDrop < 0.15, +maxDrop.toFixed(3));
  const P2 = makePad(); P2.press(PAD.A); W.w.pads = [P2.pad]; // reconnected with A already held
  const re = W.frame(1);
  check('reconnected with A already held: swims, but the arrival fires no phantom stroke', re.swim === 1 && re.kicks === 0 && W.hud().padConnected, { kicks: re.kicks, swim: re.swim });
  W.dispose();
}

// 12. arbitration: last touched wins between keyboard and pad; both beat body; idle keeps the last owner
{
  const W = makeWorld();
  const P = makePad(); W.w.pads = [P.pad];
  P.press(PAD.RT, 1); W.seconds(1);
  W.key.down('Space'); W.seconds(0.5);
  check('keyboard pressed while the pad swims → keyboard takes over', W.hud().source === 'keyboard');
  P.axis(0, 1); W.frame(5);
  check('moving the stick while a key is held does not wrestle control back (keyboard keeps it)', W.hud().source === 'keyboard');
  W.key.up('Space'); W.frame(2);
  check('key released while the pad is active → the pad has it again at once', W.hud().source === 'gamepad');
  P.neutral(); W.seconds(1.2);
  check('everything idle: the last device (pad) stays the owner, neutral intent, no autopilot', W.hud().source === 'gamepad' && W.intent.swim === 0 && !W.intent.autopilot);
  W.key.tap('Space'); W.seconds(0.2);
  check('a key tap → keyboard again', W.hud().source === 'keyboard');
  W.controls.setPrefs({ inputSource: 'gamepad' });
  W.key.down('Space'); W.frame(2);
  check('Input = Gamepad: the keyboard no longer drives the dolphin', W.hud().source === 'gamepad' && W.intent.swim === 0);
  W.key.up('Space');
  W.controls.setPrefs({ inputSource: 'keyboard' }); P.press(PAD.RT, 1); W.frame(2);
  check('Input = Keyboard: the pad no longer drives the dolphin', W.hud().source === 'keyboard' && W.intent.swim === 0);
  W.controls.setPrefs({ inputSource: 'auto' });
  W.dispose();
}

// 13. mouse look: a drag must start on the canvas; it never steals control; orbit returns as you swim
{
  const W = makeWorld();
  W.key.down('Space'); W.seconds(1.5);
  const o0 = W.rig.evalState(W.sim.state).orbitYawRad;
  W.mouse.drag(200, 0, 5, { tagName: 'DIV' });
  check('a drag that starts on the settings panel (not the canvas) does not look', near(W.rig.evalState(W.sim.state).orbitYawRad, o0, 1e-9));
  W.mouse.drag(200, 0);
  const o1 = W.rig.evalState(W.sim.state).orbitYawRad;
  check('a left-button drag on the canvas looks (orbit yaw −0.44 rad for 200 px at sensitivity 1)', near(o1, o0 - 200 * 0.0022, 1e-6), r2(o1));
  W.mouse.drag(-200, 0, 5, { tagName: 'CANVAS' }, 2);
  check('a right-button drag looks the other way', near(W.rig.evalState(W.sim.state).orbitYawRad, o0, 1e-6));
  W.w.dispatch('mousemove', { buttons: 1, movementX: 300, movementY: 0 }); W.frame(1);
  check('a move with the button down but no drag started on the canvas does not look', near(W.rig.evalState(W.sim.state).orbitYawRad, o0, 1e-6));
  W.controls.setPrefs({ lookSensitivity: 2 }); W.mouse.drag(100, 0);
  check('look sensitivity scales the drag', near(W.rig.evalState(W.sim.state).orbitYawRad, o0 - 100 * 0.0022 * 2, 1e-6));
  W.controls.setPrefs({ lookSensitivity: 1 });
  W.seconds(5);
  check('swimming on, the orbit returns behind the dolphin (|yaw| < 0.1 rad after 5 s)', Math.abs(W.rig.evalState(W.sim.state).orbitYawRad) < 0.1, r2(W.rig.evalState(W.sim.state).orbitYawRad));
  W.key.up('Space'); W.key.down('X'); W.seconds(1.5);
  W.mouse.drag(150, 40); const held = W.rig.evalState(W.sim.state);
  W.seconds(3);
  check('hovering (braked), the look stays where the player put it', near(W.rig.evalState(W.sim.state).orbitYawRad, held.orbitYawRad, 1e-9) && near(W.rig.evalState(W.sim.state).orbitPitchRad, held.orbitPitchRad, 1e-9));
  W.key.up('X');
  // mouse look never takes control from a pad
  const P = makePad(); W.w.pads = [P.pad]; P.press(PAD.RT, 1); W.seconds(0.5);
  W.mouse.drag(100, 0);
  check('mouse look while the pad swims leaves the pad in control', W.hud().source === 'gamepad');
  W.dispose();
}

// 14. window blur clears held keys (no stuck swim after alt-tab)
{
  const W = makeWorld();
  W.key.down('Space'); W.key.down('W'); W.seconds(0.5);
  check('swimming and diving', W.intent.swim === 1 && W.intent.pitch > 0.5);
  W.w.dispatch('blur');
  const i = W.frame(1);
  check('blur: every key released, axes reset', i.swim === 0 && i.pitch === 0 && W.controls.debug().keysHeld.length === 0, W.controls.debug().keysHeld);
  W.dispose();
}

// 15. typing targets and browser chords are ignored; Ctrl is not a game key
{
  const W = makeWorld();
  const e1 = W.key.down('Space', { target: { tagName: 'INPUT', isContentEditable: false } }); W.frame(1);
  check('Space in a text field: ignored and not prevented', W.intent.swim === 0 && !e1.prevented);
  W.key.up('Space');
  const e2 = W.key.down('W', { ctrlKey: true }); W.frame(1);
  check('Ctrl+W: left to the browser (not prevented, no dive)', !e2.prevented && W.intent.pitch === 0);
  W.key.up('W');
  const e3 = W.key.down('Ctrl'); W.frame(1);
  check('Ctrl alone is not a brake any more (Ctrl+W would close the tab)', !W.intent.brake && !e3.prevented);
  W.key.up('Ctrl');
  const e4 = W.key.down('Z'); W.frame(1);
  check('Z / C extra-roll keys are gone from the modern scheme (unwatched, not prevented)', W.intent.roll === 0 && !e4.prevented);
  W.key.up('Z');
  const e5 = W.key.down('Space'); W.frame(1);
  check('a game key IS prevented (no page scroll on Space)', e5.prevented && W.intent.swim === 1);
  W.key.up('Space');
  W.dispose();
}

// 16. setEnabled(false) (walker / boat own the input): held keys drop, nothing leaks back
{
  const W = makeWorld();
  W.key.down('Space'); W.key.down('D'); W.seconds(0.5);
  W.controls.setEnabled(false);
  const off = W.frame(1);
  check('disabled: neutral intent even with keys physically held', off.swim === 0 && off.roll === 0 && off.kicks === 0);
  W.key.down('Space'); W.frame(1);
  check('disabled: new presses are ignored', W.intent.swim === 0);
  W.controls.setEnabled(true);
  const on = W.frame(1);
  check('re-enabled: still neutral until a fresh press', on.swim === 0 && on.kicks === 0);
  W.key.up('Space'); W.key.down('Space'); W.frame(1);
  check('…then a fresh press swims', W.intent.swim === 1);
  W.dispose();
}

// 17. body input (PosePuppet): optional, live when present, keyboard / pad win while touched, loss glides
{
  const W = makeWorld();
  let ts = 1000; let count = 0;
  const send = (over: Parameters<typeof bodySignal>[2] = {}) => { ts += 16; W.w.dispatch('message', { data: { t: ENVELOPE, signal: bodySignal(ts, count, over) } }); };
  let kick = 0;
  W.seconds(1, () => { kick++; if (kick % 36 === 0) count++; send({ leanY: 0.5, leanX: -0.3 }); });
  check('body signals present and nothing else touched → body drives (tracking live), lean → pitch / roll', W.hud().source === 'body' && W.hud().tracking === 'live' && near(W.intent.pitch, 0.5) && near(W.intent.roll, -0.3), { pitch: W.intent.pitch, roll: W.intent.roll });
  check('body kicks counted into the sim (kickCount ≥ 1)', W.sim.state.kickCount >= 1, W.sim.state.kickCount);
  W.key.down('Space');
  W.seconds(0.5, () => send({ leanY: 0.5 }));
  check('keyboard touched: keyboard wins over live body input', W.hud().source === 'keyboard' && W.intent.swim === 1);
  W.key.up('Space');
  W.seconds(1.8, () => send({ leanY: 0.5 }));
  check('keyboard idle 1.5 s: body input resumes', W.hud().source === 'body');
  W.seconds(1);
  check('body signal lost (stale > 350 ms): autopilot glide, tracking reported lost', W.intent.autopilot && W.hud().tracking === 'autopilot');
  const P = makePad(); W.w.pads = [P.pad]; P.press(PAD.RT, 1); W.seconds(0.3, () => send({ leanY: 0.5 }));
  check('a live pad beats body input', W.hud().source === 'gamepad');
  W.dispose();
}

// 18. legacy BodyArcade profile is intact (and isolated)
{
  const W = makeWorld();
  W.controls.setPrefs({ profile: 'legacy' });
  W.key.down('Shift'); const i1 = W.frame(1);
  check('legacy: Shift press = one kick, no hold thrust', i1.kicks === 1 && i1.swim === 0 && i1.kickRate === 1.6, { kicks: i1.kicks, swim: i1.swim });
  let kicks = 0; W.seconds(1, (i) => { kicks += i.kicks; });
  check('legacy: holding Shift adds the 1.6 Hz cadence (1–2 more kicks in 1 s)', kicks >= 1 && kicks <= 2, kicks);
  W.key.up('Shift');
  W.key.down('Space'); W.frame(1); check('legacy: Space is burst', W.intent.burst && W.intent.swim === 0); W.key.up('Space');
  W.key.down('Q'); W.frame(1); check('legacy: Q trims up (−1)', W.intent.depthTrim === -1); W.key.up('Q');
  W.key.down('E'); W.frame(1); check('legacy: E trims down (+1)', W.intent.depthTrim === 1); W.key.up('E');
  W.key.down('W'); const w1 = W.frame(1); W.key.up('W');
  check('legacy: no keyboard ramp (W is full deflection at once)', w1.pitch === 1, w1.pitch);
  const P = makePad(); W.w.pads = [P.pad]; W.frame(1); P.press(PAD.A); const p1 = W.frame(1);
  check('legacy pad: A kicks (no hold thrust)', p1.kicks === 1 && p1.swim === 0, { kicks: p1.kicks, swim: p1.swim });
  P.release(PAD.A); P.press(PAD.B); W.frame(1); check('legacy pad: B bursts', W.intent.burst); P.release(PAD.B);
  P.press(PAD.RB); W.frame(1); check('legacy pad: RB trims down', W.intent.depthTrim === 1); P.release(PAD.RB);
  W.controls.setPrefs({ profile: 'ecco' });
  W.w.pads = [];
  W.key.down('Q'); W.frame(1); check('back to Modern: Q is no longer a game key', W.intent.depthTrim === 0); W.key.up('Q');
  W.dispose();
}

// 19. steering sensitivity softens keyboard deflection
{
  const W = makeWorld();
  W.controls.setPrefs({ steerSensitivity: 0.5 });
  W.key.down('W'); W.seconds(0.5);
  check('steering sensitivity 0.5: keyboard pitch deflection capped at 0.5', near(W.intent.pitch, 0.5, 1e-6), W.intent.pitch);
  W.key.up('W');
  W.controls.setPrefs({ steerSensitivity: 2 }); W.key.down('W'); W.seconds(0.5);
  check('steering sensitivity 2: keyboard stays clamped at 1 (never over-rotates the sim)', near(W.intent.pitch, 1, 1e-6), W.intent.pitch);
  W.key.up('W');
  W.dispose();
}

// 20. determinism of a keyboard-driven sequence (fresh world, identical events, identical clock)
{
  const play = () => {
    now = 0;
    const W = makeWorld();
    W.seconds(0.5); W.key.down('Space'); W.seconds(1.5); W.key.down('D'); W.seconds(1); W.key.up('D'); W.key.down('Shift'); W.seconds(1); W.key.up('Shift'); W.key.down('W'); W.seconds(0.7); W.key.up('W'); W.key.up('Space'); W.key.down('X'); W.seconds(1); W.key.up('X');
    const d = W.digest(); W.dispose(); return d;
  };
  check('the same keyboard sequence replays byte-identically', play() === play());
}

perf.now = realNow;
console.log(failed === 0 ? '\nall passed' : `\n${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
