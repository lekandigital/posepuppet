// Region dolphin — LOW-POLY PROFILE ONLY (a content-pack entry, enforced
// in main). The completed PS2 implementation adapted at its data seam and
// nothing else: SwimSim consumes the region's real sea polygons (the same
// ring convention as its SF artifact) + real bathymetry from the world
// heightfield; renderer (seabed/surface/shimmer), decor, dolphin mesh,
// chase camera and swim controls are the completed modules, imported
// unchanged. This is the SAME dolphin, swimming in a new sea — not a
// third dolphin.

import * as THREE from 'three';
import { SwimSim, SIM, NEUTRAL_INTENT, type SwimIntent, type AssistMode } from '../../../dolphin/src/game/sim';
import { createWorld, type World } from '../../../dolphin/src/game/world';
import { createDolphin, type DolphinRig } from '../../../dolphin/src/game/dolphinMesh';
import { ChaseCamera } from '../../../dolphin/src/game/camera';
import { createSwimControls, type SwimControls } from '../../../dolphin/src/input/swimControls';
import { decorate, type Decor } from '../../../dolphin/src/game/decor';
import type { BoundaryData } from '@bodyarcade/world-data';
import type { GameMode, ModeContext } from './types';
import type { WorldRuntime } from '../world/runtime';
import { createMinimap, type Minimap } from '../ui/minimap';

/** The region's sea as a Dolphin boundary artifact (same ring convention —
 *  stated in WORLD_SCHEMA.md). Sea polygons only: the dolphin lives in the
 *  fjord, not in ponds. */
export function regionBoundary(world: WorldRuntime): BoundaryData {
  const sea = world.world.layers.water.polygons.filter((p) => p.class === 'sea');
  const polygons = sea.map((p) => ({
    name: p.name ?? 'sea',
    outer: p.outer,
    holes: p.holes.map((h) => ({ name: h.name ?? null, ring: h.ring, wayIds: [] as number[] })),
  }));
  let verts = 0;
  for (const p of polygons) {
    verts += p.outer.length;
    for (const h of p.holes) verts += h.ring.length;
  }
  const w = world.world;
  return {
    format: 'bodyarcade-boundary/1',
    name: w.name,
    displayName: w.displayName,
    source: {
      attribution: w.source.attributionLines[0] ?? '© OpenStreetMap contributors (ODbL)',
    } as BoundaryData['source'],
    projection: {
      type: 'local-tangent-equirect',
      lat0: w.projection.lat0,
      lon0: w.projection.lon0,
      earthRadiusM: w.projection.earthRadiusM,
    } as BoundaryData['projection'],
    units: 'm',
    bbox: w.bbox,
    polygons: polygons as BoundaryData['polygons'],
    stats: {
      rawVertices: verts, vertices: verts, outerVertices: verts,
      areaRawM2: 0, areaM2: 0, areaDeltaPct: 0,
      simplify: { method: 'baked-upstream', minTriangleAreaM2: 0, requestedMinTriangleAreaM2: 0, minRingVerts: 0, passes: 0 },
    },
  };
}

export class DolphinMode implements GameMode {
  readonly id = 'dolphin';
  readonly sim: SwimSim;
  private controls: SwimControls;
  private underwater: World;
  private decor: Decor;
  private rig: DolphinRig;
  private cam: ChaseCamera;
  private minimap: Minimap;
  private ctx: ModeContext;
  private acc = 0;
  private lastMs: number | null = null;
  private testIntent: Partial<SwimIntent> | null = null;
  splashes = 0;

  constructor(ctx: ModeContext) {
    this.ctx = ctx;
    const world = ctx.world;
    const dive = world.spawn('dive');
    this.sim = new SwimSim({
      boundary: regionBoundary(world),
      worldScale: 1, // the region is already metres; shape sacred, size real
      spawnBoundaryXY: [dive.x, -dive.z], // scene → boundary (y = -z)
      // real bathymetry: the shared carved heightfield (one seabed for
      // sim AND render — the PS2 world builds its mesh from this too)
      depthFn: (x, z) => Math.max(2.2, world.waterDepth(x, z)),
    });
    this.controls = createSwimControls();
    this.underwater = createWorld(this.sim);
    this.decor = decorate(this.underwater.scene, this.sim);
    this.rig = createDolphin();
    this.underwater.scene.add(this.rig.group);
    this.cam = new ChaseCamera(innerWidth / Math.max(innerHeight, 1));
    this.minimap = createMinimap(document.body, world);
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('resize', this.onResize);
  }

  private onKey = (e: KeyboardEvent): void => {
    if (e.key === '1') this.sim.assist = 'full';
    if (e.key === '2') this.sim.assist = 'standard';
    if (e.key === '3') this.sim.assist = 'expert';
  };

  private onResize = (): void => {
    this.cam.camera.aspect = innerWidth / Math.max(innerHeight, 1);
    this.cam.camera.updateProjectionMatrix();
  };

  enter(): void {
    this.ctx.chrome.setMode('dolphin');
  }

  update(_dtS: number, timeS: number): void {
    const now = performance.now();
    const dtMs = this.lastMs === null ? 16 : Math.min(100, now - this.lastMs);
    this.lastMs = now;
    this.acc += dtMs / 1000;

    const live = this.controls.intent(dtMs);
    const intent: SwimIntent = this.testIntent ? { ...live, ...this.testIntent } : live;
    let kicksLeft = intent.kicks;
    while (this.acc >= SIM.DT) {
      this.sim.step({ ...intent, kicks: kicksLeft }, SIM.DT);
      kicksLeft = 0;
      this.acc -= SIM.DT;
      if (this.sim.state.splashed) this.splashes++;
    }

    const s = this.sim.state;
    this.rig.group.position.set(s.x, s.y, s.z);
    this.rig.group.rotation.set(0, 0, 0);
    this.rig.group.rotateY(s.yaw);
    this.rig.group.rotateX(s.pitch);
    this.rig.group.rotateZ(-s.roll);
    this.rig.update(timeS, intent.kickRate, s.speed);
    this.cam.update(s, dtMs / 1000);
    this.underwater.update(timeS, this.cam.camera.position.y);
    this.decor.update(timeS, s.x, s.z);
    // dolphin game coords == scene coords at scale 1 (same z = -north flip)
    this.minimap.update(s.x, s.z, (s.yaw * 180) / Math.PI);

    const hud = this.controls.hudState();
    const depth = Math.max(0, -s.y);
    this.ctx.chrome.setStatus(
      `DOLPHIN · ${s.phase === 'air' ? 'AIRBORNE' : hud.tracking.toUpperCase()} · ` +
      `${s.speed.toFixed(1)} M/S · DEPTH ${depth.toFixed(1)} M · ` +
      `KICKS ${s.kickCount} · ${this.sim.assist.toUpperCase()}`,
    );
    if (hud.tracking === 'autopilot' || hud.tracking === 'stale') {
      this.ctx.chrome.setCoach('Tracking lost — gliding level. Step back into frame.');
    } else if (hud.tracking === 'live' && !hud.hipsQuiet && s.kickCount === 0) {
      this.ctx.chrome.setCoach('Bob chest and hips in a smooth wave to kick.');
    } else {
      this.ctx.chrome.setCoach('');
    }
  }

  /** Dolphin renders its own underwater scene (the PS2 look). */
  render(renderer: THREE.WebGLRenderer): boolean {
    renderer.render(this.underwater.scene, this.cam.camera);
    return true;
  }

  state(): Record<string, unknown> {
    const s = this.sim.state;
    return {
      phase: s.phase, x: s.x, y: s.y, z: s.z,
      yaw: s.yaw, pitch: s.pitch, roll: s.roll, speed: s.speed,
      kickCount: s.kickCount, breachCount: s.breachCount,
      inWater: this.sim.inWater(s.x, s.z),
      shoreDist: this.sim.shoreDistance(s.x, s.z),
      depthHere: this.sim.depthAt(s.x, s.z),
      assist: this.sim.assist,
      tracking: this.controls.hudState().tracking,
      splashes: this.splashes,
    };
  }

  setTestIntent(p: Partial<SwimIntent> | null): void { this.testIntent = p; }
  teleport(x: number, z: number, y = -6): void {
    this.sim.state.x = x; this.sim.state.z = z; this.sim.state.y = y;
  }
  setYaw(yaw: number): void { this.sim.state.yaw = yaw; }
  setAssist(a: AssistMode): void { this.sim.assist = a; }
  neutral(): SwimIntent { return { ...NEUTRAL_INTENT }; }

  dispose(): void {
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('resize', this.onResize);
    this.minimap.dispose();
  }
}
