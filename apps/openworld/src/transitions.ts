// ModeManager — the honest fade + spawn handoff (TRANSITIONS.md).
// Owns the active mode, the fade veil, the global F trigger, and
// per-frame eligibility (coach + __OW.transition() surface).

import type * as THREE from 'three';
import type { GameMode, ModeContext } from './modes/types';
import type { TransitionPoint } from './world/runtime';
import { FlightMode } from './modes/flight';
import { WalkMode } from './modes/walk';
import { RowMode } from './modes/row';
import { DolphinMode } from './modes/dolphin';
import type { ModeId } from './profiles/types';

const MONO = "ui-monospace, 'JetBrains Mono', Menlo, monospace";

export interface EligibleTransition {
  to: ModeId;
  point: TransitionPoint;
  label: string;
}

export class ModeManager {
  mode: GameMode | null = null;
  private ctx: ModeContext;
  private modes: ModeId[];
  private veil: HTMLDivElement;
  private switching = false;
  private eligible: EligibleTransition | null = null;
  private poseModel: ((m: 'full' | 'lite') => void) | null = null;

  constructor(ctx: ModeContext, profileModes: ModeId[]) {
    this.ctx = ctx;
    this.modes = profileModes;
    this.veil = document.createElement('div');
    this.veil.dataset.testid = 'ow-veil';
    this.veil.style.cssText = [
      'position:fixed', 'inset:0', 'background:#0a0c10', 'opacity:0',
      'transition:opacity 180ms ease', 'pointer-events:none', 'z-index:40',
      'display:flex', 'align-items:center', 'justify-content:center',
      `font:14px/1.4 ${MONO}`, 'color:#cfd8e3', 'letter-spacing:0.2em',
    ].join(';');
    document.body.appendChild(this.veil);
    window.addEventListener('keydown', this.onKey);
  }

  /** Rowing wants the FULL pose model (wrist depth); everything else lite. */
  onPoseModel(fn: (m: 'full' | 'lite') => void): void {
    this.poseModel = fn;
  }

  private onKey = (e: KeyboardEvent): void => {
    if (e.key.toLowerCase() !== 'f' || this.switching) return;
    if (this.eligible) void this.switch(this.eligible.to, this.eligible.point);
  };

  private create(id: ModeId | 'flyover', at?: { x: number; z: number; yawDeg: number }): GameMode {
    switch (id) {
      case 'walk': {
        const m = new WalkMode(this.ctx);
        m.enter();
        if (at) m.enterAt(at.x, at.z, at.yawDeg);
        return m;
      }
      case 'row': {
        const m = new RowMode(this.ctx);
        m.enter();
        if (at) m.enterAt(at.x, at.z);
        return m;
      }
      case 'dolphin': {
        const m = new DolphinMode(this.ctx);
        m.enter();
        if (at) m.teleport(at.x, at.z, -6);
        return m;
      }
      default: {
        const m = new FlightMode(this.ctx);
        m.enter();
        return m;
      }
    }
  }

  start(id: string): void {
    const legal: ModeId | 'flyover' =
      id === 'dolphin' && !this.modes.includes('dolphin') ? 'flight' : (id as ModeId);
    this.mode = this.create(legal);
  }

  async switch(to: ModeId, point?: TransitionPoint): Promise<void> {
    if (this.switching) return;
    this.switching = true;
    this.veil.textContent = to.toUpperCase();
    this.veil.style.opacity = '1';
    await new Promise((r) => setTimeout(r, 200));
    this.mode?.dispose();
    const at = point ? this.entryFor(to, point) : undefined;
    this.mode = this.create(to, at);
    this.poseModel?.(to === 'row' ? 'full' : 'lite');
    this.veil.style.opacity = '0';
    this.switching = false;
    this.eligible = null;
  }

  private entryFor(to: ModeId, p: TransitionPoint): { x: number; z: number; yawDeg: number } {
    if (to === 'row') {
      // spawn on the row lattice off this dock/dive point
      const n = this.ctx.world.nearestRowNode(p.x, p.z);
      const [x, z] = this.ctx.world.rowNodeScene(n);
      return { x, z, yawDeg: 0 };
    }
    if (to === 'walk' && p.walkNode !== undefined && p.walkNode !== null) {
      const [wx, wy] = this.ctx.world.world.nav.walk.nodes[p.walkNode];
      const [x, z] = this.ctx.world.toScene(wx, wy);
      return { x, z, yawDeg: 0 };
    }
    return { x: p.x, z: p.z, yawDeg: 0 };
  }

  /** Per-frame: recompute eligibility, surface the coach offer. */
  update(): void {
    if (this.switching || !this.mode) return;
    this.eligible = this.eligibleNow();
    if (this.eligible) {
      this.ctx.chrome.setCoach(`${this.eligible.label} — press F.`);
    }
  }

  private pos(): { x: number; z: number } | null {
    const m = this.mode;
    if (m instanceof FlightMode) return { x: m.x, z: m.z };
    if (m instanceof RowMode) return { x: m.x, z: m.z };
    if (m instanceof WalkMode) {
      const s = m.state() as { x: number; z: number };
      return { x: s.x, z: s.z };
    }
    if (m instanceof DolphinMode) {
      const s = m.sim.state;
      return { x: s.x, z: s.z };
    }
    return null;
  }

  private eligibleNow(): EligibleTransition | null {
    const m = this.mode;
    const p = this.pos();
    if (!m || !p) return null;
    const world = this.ctx.world;
    const near = (t: TransitionPoint, grace = 40): boolean =>
      Math.hypot(p.x - t.x, p.z - t.z) <= t.radiusM + grace;

    if (m instanceof FlightMode) {
      const t = world.transitions('land-to-walk')[0];
      if (!t || !near(t, 80)) return null;
      const agl = m.y - world.groundY(m.x, m.z);
      if (agl < 18 && m.speed < 30) return { to: 'walk', point: t, label: 'Land here and walk' };
      return null;
    }
    if (m instanceof WalkMode) {
      for (const t of world.transitions('dock-to-row')) {
        if (near(t)) return { to: 'row', point: t, label: 'Take the boat out' };
      }
      const a = world.transitions('land-to-walk')[0];
      if (a && near(a, 60)) return { to: 'flight', point: a, label: 'Board the plane' };
      return null;
    }
    if (m instanceof RowMode) {
      if (this.modes.includes('dolphin')) {
        for (const t of world.transitions('row-to-dive')) {
          if (near(t)) return { to: 'dolphin', point: t, label: 'Dive as the dolphin' };
        }
      }
      for (const t of world.transitions('dock-to-row')) {
        if (near(t)) return { to: 'walk', point: t, label: 'Tie up and walk' };
      }
      return null;
    }
    if (m instanceof DolphinMode) {
      if (m.sim.state.y > -4) {
        for (const t of world.transitions('row-to-dive')) {
          if (near(t, 60)) return { to: 'row', point: t, label: 'Surface into the boat' };
        }
      }
      return null;
    }
    return null;
  }

  transitionState(): { eligible: string | null; label: string | null } {
    return {
      eligible: this.eligible?.to ?? null,
      label: this.eligible?.label ?? null,
    };
  }

  /** Test hook: force a switch. */
  forceSwitch(to: ModeId): Promise<void> {
    const pt = undefined;
    return this.switch(to, pt);
  }

  render(renderer: THREE.WebGLRenderer): boolean {
    return this.mode?.render?.(renderer) ?? false;
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKey);
    this.veil.remove();
    this.mode?.dispose();
  }
}
