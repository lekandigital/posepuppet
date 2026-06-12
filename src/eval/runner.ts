// In-page eval collector. Activated by ?eval=<fixture>; gathers detection
// rate, pose/render FPS, dropped frames, memory samples, and the sync
// metric, then publishes window.__EVAL_RESULT for the node runner
// (eval/run.mjs) to collect — or renders it as JSON for a human.

import * as THREE from 'three';
import type { Stage } from '../stage/scene';
import type { Avatar } from '../rig/types';
import type { PoseDetector } from '../pose/detector';
import type { LandmarkPoint } from '../pose/types';
import { sampleLimbAngles, SyncAccumulator, type LimbName } from './sync';

export interface EvalResult {
  fixture: string;
  avatar: string;
  durationSec: number;
  videoFrames: number;
  detectedFrames: number;
  detectionRate: number;
  poseFps: number;
  renderFps: number;
  droppedFrames: number;
  delegate: 'GPU' | 'CPU';
  memoryMB: Record<string, number> | null;
  sync: Partial<Record<LimbName | 'upperLimbsMean' | 'legsMean', number>>;
  /** face-touch reach check (frames where the person's wrist was at their
   *  head): does the avatar's wrist reach its own head region without
   *  passing through it? */
  faceTouch?: {
    engagedFrames: number;
    reachFrames: number;
    penetrationFrames: number;
    reachRate: number;
    penetrationRate: number;
  };
  finishedAt: string;
}

declare global {
  interface Window {
    __EVAL_RESULT?: EvalResult;
  }
}

interface Deps {
  stage: Stage;
  detector: PoseDetector;
  video: HTMLVideoElement;
  getAvatar: () => Avatar;
  /** avatar head-collider radius (m), from the retargeter's bind pass */
  getHeadRadius?: () => number;
  /** live face-touch engagement weights from the retargeter */
  getFaceTouch?: () => { left: { w: number }; right: { w: number } };
}

export class EvalCollector {
  private videoFrames = 0;
  private detectedFrames = 0;
  private sync = new SyncAccumulator();
  private renderFpsSamples: number[] = [];
  private poseFpsSamples: number[] = [];
  private memory: Record<string, number> = {};
  private startTime = 0;
  private done = false;
  private ftEngaged = 0;
  private ftReach = 0;
  private ftPenetration = 0;
  private ftWrist = new THREE.Vector3();
  private ftHead = new THREE.Vector3();

  constructor(
    private fixture: string,
    private durationSec: number,
    private deps: Deps,
  ) {}

  start(): void {
    this.startTime = performance.now();
    this.sampleMemory('t0');
    const half = Math.floor(this.durationSec / 2);
    setTimeout(() => this.sampleMemory(`t${half}`), half * 1000);
    setTimeout(() => this.finish(), this.durationSec * 1000);

    const sampler = setInterval(() => {
      if (this.done) {
        clearInterval(sampler);
        return;
      }
      const rf = this.deps.stage.renderFps();
      const pf = this.deps.detector.poseFps();
      if (rf > 0) this.renderFpsSamples.push(rf);
      if (pf > 0) this.poseFpsSamples.push(pf);
    }, 1000);
  }

  /** Called once per processed video frame, with mirrored landmarks (the
   *  space the avatar enacts) or null when nothing was detected. */
  onPoseFrame(mirroredNorm: LandmarkPoint[] | null): void {
    if (this.done || this.startTime === 0) return;
    this.videoFrames++;
    if (!mirroredNorm) return;
    this.detectedFrames++;

    const { stage, video, getAvatar } = this.deps;
    const aspect = stage.canvas.clientWidth / Math.max(1, stage.canvas.clientHeight);
    const avatar = getAvatar();
    this.sync.add(
      sampleLimbAngles(mirroredNorm, video.videoWidth, video.videoHeight, avatar, stage.camera, aspect),
    );

    // face-touch reach check: frames where a wrist sits at the head
    // (normalized space, shoulder-width units) → the avatar's wrist must
    // land at its own head surface, never inside it
    const headR = this.deps.getHeadRadius?.() ?? 0.12;
    const ft = this.deps.getFaceTouch?.();
    if (ft) {
      for (const side of ['left', 'right'] as const) {
        // engaged = the retargeter itself says the magnetism is active —
        // the metric measures what the system claims to do
        if (ft[side].w < 0.6) continue;
        const wristJ = avatar.joints[`${side}Wrist`];
        const headB = avatar.bones.head;
        if (!wristJ || !headB) continue;
        this.ftEngaged++;
        wristJ.getWorldPosition(this.ftWrist);
        headB.getWorldPosition(this.ftHead);
        const d = this.ftWrist.distanceTo(this.ftHead);
        if (d <= headR * 2.0) this.ftReach++;
        if (d < headR * 0.7) this.ftPenetration++;
      }
    }
  }

  private sampleMemory(label: string): void {
    const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
    if (mem) this.memory[label] = Math.round(mem.usedJSHeapSize / 1e6);
  }

  private mean(xs: number[]): number {
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
  }

  private finish(): void {
    if (this.done) return;
    this.done = true;
    this.sampleMemory(`t${this.durationSec}`);

    const round = (v: number) => Math.round(v * 100) / 100;
    const sync: EvalResult['sync'] = {};
    for (const [k, v] of Object.entries(this.sync.means())) {
      sync[k as LimbName] = round(v as number);
    }

    const faceTouch =
      this.ftEngaged > 0
        ? {
            engagedFrames: this.ftEngaged,
            reachFrames: this.ftReach,
            penetrationFrames: this.ftPenetration,
            reachRate: Math.round((this.ftReach / this.ftEngaged) * 1000) / 1000,
            penetrationRate: Math.round((this.ftPenetration / this.ftEngaged) * 1000) / 1000,
          }
        : undefined;

    const result: EvalResult = {
      fixture: this.fixture,
      avatar: this.deps.getAvatar().name, // actual, not requested
      durationSec: this.durationSec,
      videoFrames: this.videoFrames,
      detectedFrames: this.detectedFrames,
      detectionRate: round(this.videoFrames ? this.detectedFrames / this.videoFrames : 0),
      poseFps: round(this.mean(this.poseFpsSamples)),
      renderFps: round(this.mean(this.renderFpsSamples)),
      droppedFrames: this.deps.detector.droppedFrames(),
      delegate: this.deps.detector.delegate(),
      memoryMB: Object.keys(this.memory).length ? this.memory : null,
      sync,
      faceTouch,
      finishedAt: new Date().toISOString(),
    };
    window.__EVAL_RESULT = result;
    console.log('EVAL_RESULT', JSON.stringify(result));

    const pre = document.createElement('pre');
    pre.id = 'eval-result';
    pre.style.cssText =
      'position:fixed;bottom:40px;left:10px;z-index:99;background:#000c;color:#7fdc9a;' +
      'padding:10px;font-size:11px;max-width:46vw;overflow:auto;max-height:50vh;';
    pre.textContent = JSON.stringify(result, null, 2);
    document.body.appendChild(pre);
  }
}
