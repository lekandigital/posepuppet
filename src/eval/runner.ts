// In-page eval collector. Activated by ?eval=<fixture>; gathers detection
// rate, pose/render FPS, dropped frames, memory samples, and the sync
// metric, then publishes window.__EVAL_RESULT for the node runner
// (eval/run.mjs) to collect — or renders it as JSON for a human.

import * as THREE from 'three';
import type { Stage } from '../stage/scene';
import type { Avatar } from '../rig/types';
import type { PoseDetector } from '@bodyarcade/pose-runtime';
import type { LandmarkPoint } from '@bodyarcade/pose-runtime';
import { sampleLimbAngles, SyncAccumulator, type LimbName } from './sync';
import { PPC_GROUP_OF, type PpcGroupInfo } from '@bodyarcade/pose-runtime';
import { LM } from '@bodyarcade/pose-runtime';

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
  /** hand-only mode: pinch→jaw tracking quality (Pearson r between the
   *  normalized pinch input and the enacted jaw angle, per frame) */
  pinchJaw?: { r: number; samples: number };
  /** face-touch reach check (frames where the person's wrist was at their
   *  head): does the avatar's wrist reach its own head region without
   *  passing through it? V2 adds per-socket engagement and a capsule-based
   *  penetration count (signed surface distance, not center distance). */
  faceTouch?: {
    engagedFrames: number;
    reachFrames: number;
    penetrationFrames: number;
    reachRate: number;
    penetrationRate: number;
    /** engaged/reached frames per named socket (face-touch v2) */
    sockets?: Record<string, { engaged: number; reached: number }>;
  };
  /** hand fusion (V5): finger-curl input ↔ enacted-bone correlation on
   *  capable rigs, plus the gate state — incapable rigs must show
   *  gated=true and applyCount=0 */
  fingerCurl?: { r: number; samples: number; inputRange: number };
  fusion?: { active: boolean; gated: boolean; applyCount: number; detectFps: number };
  /** feet v2 (full-body fixtures). Skating = NET SLIDE of an ankle over a
   *  contiguous planted window (what the eye sees); drift = per-frame
   *  jitter (servo/roll wobble). Both reported, slide is the contract. */
  feet?: {
    plantedFrames: number;
    meanDriftPx: number;
    p95DriftPx: number;
    maxDriftPx: number;
    windows: number;
    meanSlidePx: number;
    p95SlidePx: number;
    maxSlidePx: number;
    steps: number;
  };
  /** Predictive Pose Continuity masked-run metrics. posErr compares the
   *  PPC output against same-frame ground truth during PREDICTED, next to
   *  the legacy comparator (hold-last-visible), in meters. Present only
   *  when a ?mask= spec was active; posErr only when PPC was enabled. */
  ppc?: {
    enabled: boolean;
    mask: string;
    maskedFrames: number;
    predictedSamples: number;
    posErr?: {
      ppcMean: number;
      ppcP95: number;
      holdMean: number;
      holdP95: number;
    };
    /** diagnostics: error split by limb kind and by prediction age */
    posErrBreakdown?: Record<string, { ppc: number; hold: number; n: number }>;
    reentryMaxDelta: number;
    horizonMaxMs: number;
    nanCount: number;
    /** sync vs the truth stream over MASKED frames only — the end-to-end
     *  "did the puppet keep matching the person while blind" number */
    syncMasked: Partial<Record<LimbName | 'upperLimbsMean' | 'legsMean', number>>;
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
  /** live face-touch engagement + v2 socket/penetration debug */
  getFaceTouch?: () => {
    left: { w: number; socket?: string | null; pen?: boolean };
    right: { w: number; socket?: string | null; pen?: boolean };
  };
  /** signed distance (m) of the ENACTED avatar wrist to the head capsule
   *  surface (< 0 = inside) — face-touch v2 ground truth */
  getWristCapsuleDistance?: (side: 'left' | 'right') => number;
  /** feet v2 plant states from the retargeter */
  getFeetDebug?: () => {
    left: { planted: boolean; weight: number; plantEvents: number };
    right: { planted: boolean; weight: number; plantEvents: number };
  };
  /** hand fusion gate + per-ENACTED-side fresh input curls (null = stale) */
  getFusion?: () => {
    active: boolean;
    gated: boolean;
    applyCount: number;
    detectFps: number;
    inputCurl: (side: 'left' | 'right') => number | null;
  };
  /** detection-loop FPS override (hand mode reports the hand detector) */
  getDetectionFps?: () => number;
}

/** During whole-frame dropouts, error is measured on this key subset so
 *  eleven face landmarks don't drown the limbs. */
const PPC_KEY_LMS: number[] = [
  LM.nose, LM.leftShoulder, LM.rightShoulder, LM.leftElbow, LM.rightElbow,
  LM.leftWrist, LM.rightWrist, LM.leftHip, LM.rightHip,
  LM.leftKnee, LM.rightKnee, LM.leftAnkle, LM.rightAnkle,
];

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
  private ftSockets = new Map<string, { engaged: number; reached: number }>();
  private pjPinch: number[] = [];
  private pjJaw: number[] = [];
  // hand fusion: input curl ↔ enacted bone curl pairs (capable rigs)
  private fcInput: number[] = [];
  private fcEnacted: number[] = [];
  private fusionSeen: { active: boolean; gated: boolean; applyCount: number; detectFps: number } | null = null;
  // feet v2: planted-ankle screen drift (px/frame)
  private feetDrift: number[] = [];
  private feetPlantedFrames = 0;
  private feetSteps = 0;
  private prevAnkle = {
    left: { x: 0, y: 0, valid: false, startX: 0, startY: 0 },
    right: { x: 0, y: 0, valid: false, startX: 0, startY: 0 },
  };
  private feetSlides: number[] = [];
  private ankleV = new THREE.Vector3();

  // --- PPC masked-run state ---
  private ppcMask: string | null = null;
  private ppcEnabled = false;
  private ppcSyncMasked = new SyncAccumulator();
  private ppcMaskedFrames = 0;
  private ppcErrs: number[] = [];
  private ppcHoldErrs: number[] = [];
  /** parallel tags: `${kind}` and `${ageBucket}` per sample */
  private ppcTags: string[] = [];
  private ppcReentryMax = 0;
  private ppcHorizonMax = 0;
  private ppcNaN = 0;
  /** last truth position per landmark while unmasked (the legacy hold) */
  private ppcHold: Float64Array | null = null;
  /** previous PPC output per landmark, for re-entry step measurement */
  private ppcPrev: Float64Array | null = null;
  private ppcPrevSet: boolean[] = [];

  constructor(
    private fixture: string,
    private durationSec: number,
    private deps: Deps,
  ) {}

  /** Masked-run frames: same-frame ground truth vs the PPC output.
   *  truthWorld = pre-mask mirrored world; contWorld = what the pipeline
   *  actually consumed (null once PPC faded or when PPC is off during a
   *  whole-frame dropout). */
  onPpcFrame(
    mask: string,
    enabled: boolean,
    truthWorld: LandmarkPoint[],
    truthNorm: LandmarkPoint[],
    contWorld: LandmarkPoint[] | null,
    masked: number[],
    dropped: boolean,
    states: readonly PpcGroupInfo[],
  ): void {
    if (this.done || this.startTime === 0) return;
    this.ppcMask = mask;
    this.ppcEnabled = enabled;

    // masked-frames-only sync vs truth: the whole-run mean dilutes ~10%
    // masked frames beyond visibility — this is the during-blackout number
    if (masked.length > 0) {
      const { stage, video, getAvatar } = this.deps;
      const aspect = stage.canvas.clientWidth / Math.max(1, stage.canvas.clientHeight);
      this.ppcSyncMasked.add(
        sampleLimbAngles(truthNorm, video.videoWidth, video.videoHeight, getAvatar(), stage.camera, aspect),
      );
    }
    if (!this.ppcHold) {
      this.ppcHold = new Float64Array(33 * 3);
      this.ppcPrev = new Float64Array(33 * 3);
      this.ppcPrevSet = Array.from({ length: 33 }, () => false);
    }
    if (masked.length > 0) this.ppcMaskedFrames++;

    const stateOf = new Map<string, PpcGroupInfo>();
    for (const s of states) stateOf.set(s.name, s);
    for (const s of states) {
      if (s.state === 'PREDICTED') this.ppcHorizonMax = Math.max(this.ppcHorizonMax, s.ageMs);
    }

    const maskedSet = new Set(masked);
    for (let i = 0; i < 33; i++) {
      const t = truthWorld[i];
      // legacy hold reference: freeze at the last unmasked frame
      if (!maskedSet.has(i)) {
        this.ppcHold[i * 3] = t.x;
        this.ppcHold[i * 3 + 1] = t.y;
        this.ppcHold[i * 3 + 2] = t.z;
      }
      const group = PPC_GROUP_OF[i];
      const g = group ? stateOf.get(group) : undefined;
      const o = contWorld?.[i];

      if (o && !(Number.isFinite(o.x) && Number.isFinite(o.y) && Number.isFinite(o.z))) {
        this.ppcNaN++;
        continue;
      }

      // position error during PREDICTED only (the metric's definition);
      // whole-frame dropouts sample the key subset
      if (
        enabled && o && g?.state === 'PREDICTED' && maskedSet.has(i) &&
        (!dropped || PPC_KEY_LMS.includes(i))
      ) {
        this.ppcErrs.push(Math.hypot(o.x - t.x, o.y - t.y, o.z - t.z));
        this.ppcHoldErrs.push(
          Math.hypot(this.ppcHold[i * 3] - t.x, this.ppcHold[i * 3 + 1] - t.y, this.ppcHold[i * 3 + 2] - t.z),
        );
        const kind = group === 'torso' || group === 'head' ? 'core' : group!.endsWith('Leg') ? 'leg' : 'arm';
        this.ppcTags.push(`${kind}|${g.ageMs < 150 ? 'early' : 'late'}`);
      }

      // re-entry no-snap: max per-frame output step while the group blends
      if (o && this.ppcPrev) {
        if (g?.blending && this.ppcPrevSet[i]) {
          this.ppcReentryMax = Math.max(
            this.ppcReentryMax,
            Math.hypot(o.x - this.ppcPrev[i * 3], o.y - this.ppcPrev[i * 3 + 1], o.z - this.ppcPrev[i * 3 + 2]),
          );
        }
        this.ppcPrev[i * 3] = o.x;
        this.ppcPrev[i * 3 + 1] = o.y;
        this.ppcPrev[i * 3 + 2] = o.z;
        this.ppcPrevSet[i] = true;
      } else {
        this.ppcPrevSet[i] = false;
      }
    }
  }

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
      const pf = this.deps.getDetectionFps?.() ?? this.deps.detector.poseFps();
      if (rf > 0) this.renderFpsSamples.push(rf);
      if (pf > 0) this.poseFpsSamples.push(pf);
    }, 1000);
  }

  /** Hand-only mode frames: detection bookkeeping + the pinch→jaw pair
   *  for the correlation metric (only when the beaky puppet is live). */
  onHandFrame(detected: boolean, signals: { pinch: number; jaw: number } | null): void {
    if (this.done || this.startTime === 0) return;
    this.videoFrames++;
    if (!detected) return;
    this.detectedFrames++;
    if (signals) {
      this.pjPinch.push(signals.pinch);
      this.pjJaw.push(signals.jaw);
    }
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
    // land at its own head surface, never inside it. V2: signed distance
    // to the head CAPSULE where available, plus per-socket bookkeeping.
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
        let reached = false;
        const sd = this.deps.getWristCapsuleDistance?.(side);
        if (sd !== undefined && Number.isFinite(sd)) {
          // within ~a radius of the surface = contact reads on camera
          reached = sd <= headR * 0.9;
          if (reached) this.ftReach++;
          if (sd < -headR * 0.12) this.ftPenetration++;
        } else {
          wristJ.getWorldPosition(this.ftWrist);
          headB.getWorldPosition(this.ftHead);
          const d = this.ftWrist.distanceTo(this.ftHead);
          reached = d <= headR * 2.0;
          if (reached) this.ftReach++;
          if (d < headR * 0.7) this.ftPenetration++;
        }
        const socket = ft[side].socket;
        if (socket) {
          const s = this.ftSockets.get(socket) ?? { engaged: 0, reached: 0 };
          s.engaged++;
          if (reached) s.reached++;
          this.ftSockets.set(socket, s);
        }
      }
    }

    // hand fusion: input curl vs enacted bone curl on capable rigs
    const fu = this.deps.getFusion?.();
    if (fu) {
      this.fusionSeen = { active: fu.active, gated: fu.gated, applyCount: fu.applyCount, detectFps: fu.detectFps };
      if (fu.active && avatar.fingerCurlEnacted) {
        for (const side of ['left', 'right'] as const) {
          const input = fu.inputCurl(side);
          if (input === null) continue;
          const enacted = avatar.fingerCurlEnacted(side);
          if (!Number.isFinite(enacted)) continue;
          this.fcInput.push(input);
          this.fcEnacted.push(enacted);
        }
      }
    }

    // feet v2: planted-ankle drift on the stage, in screen px per frame
    const feet = this.deps.getFeetDebug?.();
    if (feet) {
      const cw = this.deps.stage.canvas.clientWidth;
      const ch = this.deps.stage.canvas.clientHeight;
      for (const side of ['left', 'right'] as const) {
        const prev = this.prevAnkle[side];
        const ankleJ = avatar.joints[`${side}Ankle`];
        if (!feet[side].planted || !ankleJ) {
          if (prev.valid) {
            // window closed: record the NET slide while planted
            this.feetSlides.push(Math.hypot(prev.x - prev.startX, prev.y - prev.startY));
          }
          prev.valid = false;
          continue;
        }
        this.feetPlantedFrames++;
        ankleJ.getWorldPosition(this.ankleV).project(this.deps.stage.camera);
        const px = ((this.ankleV.x + 1) / 2) * cw;
        const py = ((1 - this.ankleV.y) / 2) * ch;
        if (prev.valid) {
          this.feetDrift.push(Math.hypot(px - prev.x, py - prev.y));
        } else {
          prev.startX = px;
          prev.startY = py;
        }
        prev.x = px;
        prev.y = py;
        prev.valid = true;
      }
      this.feetSteps = feet.left.plantEvents + feet.right.plantEvents;
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

    const pearson = (xs: number[], ys: number[]): number => {
      const n = xs.length;
      const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
      const mx = mean(xs);
      const my = mean(ys);
      let num = 0;
      let dx = 0;
      let dy = 0;
      for (let i = 0; i < n; i++) {
        const a = xs[i] - mx;
        const b = ys[i] - my;
        num += a * b;
        dx += a * a;
        dy += b * b;
      }
      const denom = Math.sqrt(dx * dy);
      return denom > 1e-9 ? Math.round((num / denom) * 1000) / 1000 : 0;
    };

    let pinchJaw: EvalResult['pinchJaw'];
    if (this.pjPinch.length > 30) {
      pinchJaw = { r: pearson(this.pjPinch, this.pjJaw), samples: this.pjPinch.length };
    }

    let fingerCurl: EvalResult['fingerCurl'];
    if (this.fcInput.length > 30) {
      const sorted = [...this.fcInput].sort((a, b) => a - b);
      const p = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
      fingerCurl = {
        r: pearson(this.fcInput, this.fcEnacted),
        samples: this.fcInput.length,
        // detection must have SEEN real open/close travel, or r is vacuous
        inputRange: Math.round((p(0.95) - p(0.05)) * 1000) / 1000,
      };
    }

    const faceTouch =
      this.ftEngaged > 0
        ? {
            engagedFrames: this.ftEngaged,
            reachFrames: this.ftReach,
            penetrationFrames: this.ftPenetration,
            reachRate: Math.round((this.ftReach / this.ftEngaged) * 1000) / 1000,
            penetrationRate: Math.round((this.ftPenetration / this.ftEngaged) * 1000) / 1000,
            sockets: this.ftSockets.size ? Object.fromEntries(this.ftSockets) : undefined,
          }
        : undefined;

    let feet: EvalResult['feet'];
    if (this.feetPlantedFrames > 0) {
      // close still-open planted windows
      for (const side of ['left', 'right'] as const) {
        const prev = this.prevAnkle[side];
        if (prev.valid) this.feetSlides.push(Math.hypot(prev.x - prev.startX, prev.y - prev.startY));
      }
      const d = [...this.feetDrift].sort((a, b) => a - b);
      const sl = [...this.feetSlides].sort((a, b) => a - b);
      const r2 = (v: number) => Math.round(v * 100) / 100;
      const p95 = (xs: number[]) => (xs.length ? xs[Math.min(xs.length - 1, Math.floor(xs.length * 0.95))] : 0);
      feet = {
        plantedFrames: this.feetPlantedFrames,
        meanDriftPx: r2(d.length ? d.reduce((a, b) => a + b, 0) / d.length : 0),
        p95DriftPx: r2(p95(d)),
        maxDriftPx: r2(d.length ? d[d.length - 1] : 0),
        windows: sl.length,
        meanSlidePx: r2(sl.length ? sl.reduce((a, b) => a + b, 0) / sl.length : 0),
        p95SlidePx: r2(p95(sl)),
        maxSlidePx: r2(sl.length ? sl[sl.length - 1] : 0),
        steps: this.feetSteps,
      };
    }

    let ppc: EvalResult['ppc'];
    if (this.ppcMask) {
      const p95 = (xs: number[]): number => {
        if (!xs.length) return 0;
        const s = [...xs].sort((a, b) => a - b);
        return s[Math.min(s.length - 1, Math.floor(s.length * 0.95))];
      };
      const mean = (xs: number[]): number =>
        xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
      const r4 = (v: number) => Math.round(v * 10000) / 10000;
      ppc = {
        enabled: this.ppcEnabled,
        mask: this.ppcMask,
        maskedFrames: this.ppcMaskedFrames,
        predictedSamples: this.ppcErrs.length,
        posErr: this.ppcErrs.length
          ? {
              ppcMean: r4(mean(this.ppcErrs)),
              ppcP95: r4(p95(this.ppcErrs)),
              holdMean: r4(mean(this.ppcHoldErrs)),
              holdP95: r4(p95(this.ppcHoldErrs)),
            }
          : undefined,
        posErrBreakdown: this.ppcErrs.length
          ? (() => {
              const acc = new Map<string, { p: number; h: number; n: number }>();
              for (let i = 0; i < this.ppcErrs.length; i++) {
                for (const tag of this.ppcTags[i].split('|')) {
                  const a = acc.get(tag) ?? { p: 0, h: 0, n: 0 };
                  a.p += this.ppcErrs[i];
                  a.h += this.ppcHoldErrs[i];
                  a.n++;
                  acc.set(tag, a);
                }
              }
              const out: Record<string, { ppc: number; hold: number; n: number }> = {};
              for (const [k, a] of acc) out[k] = { ppc: r4(a.p / a.n), hold: r4(a.h / a.n), n: a.n };
              return out;
            })()
          : undefined,
        reentryMaxDelta: r4(this.ppcReentryMax),
        horizonMaxMs: Math.round(this.ppcHorizonMax),
        nanCount: this.ppcNaN,
        syncMasked: (() => {
          const out: NonNullable<EvalResult['ppc']>['syncMasked'] = {};
          for (const [k, v] of Object.entries(this.ppcSyncMasked.means())) {
            out[k as LimbName] = Math.round((v as number) * 100) / 100;
          }
          return out;
        })(),
      };
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
      pinchJaw,
      faceTouch,
      fingerCurl,
      fusion: this.fusionSeen ?? undefined,
      feet,
      ppc,
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
