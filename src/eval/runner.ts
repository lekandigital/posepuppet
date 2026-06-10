// In-page eval collector. Activated by ?eval=<fixture>; gathers detection
// rate, pose/render FPS, dropped frames, memory samples, and the sync
// metric, then publishes window.__EVAL_RESULT for the node runner
// (eval/run.mjs) to collect — or renders it as JSON for a human.

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
  sync: Partial<Record<LimbName | 'upperLimbsMean', number>>;
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
    this.sync.add(
      sampleLimbAngles(mirroredNorm, video.videoWidth, video.videoHeight, getAvatar(), stage.camera, aspect),
    );
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
