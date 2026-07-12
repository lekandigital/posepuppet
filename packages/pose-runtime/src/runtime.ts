// createPoseRuntime — the composed tracking pipeline any page initializes
// directly: camera ownership + lifecycle, detector, mirroring, Predictive
// Pose Continuity, body-input emission, HUD preview state, and producer
// election. Extracted from the Full App's boot (src/main.ts) — the pipeline
// order is bit-identical: detect → mirror → [interceptor] → PPC → fan-out.
//
// Trust boundary: `onFrame` is an IN-PROCESS tap for the owning app (the
// Full App retargets from it; the eval rig reads truth streams from it).
// Everything that leaves the page — BroadcastChannel, postMessage — is
// BodySignal only; the HUD receives PreviewFrame (quantized 2D render
// state) in-process. Raw landmarks never ride a transport (boundary test).

import {
  createBodyInputCore,
  createBroadcastSink,
  createInPageChannel,
  mountTuner,
  DEFAULT_CHANNEL,
  type BodyInputCore,
  type BodySignal,
  type BodySignalSource,
  type BodyTracking,
  type TrackingState,
} from '@bodyarcade/body-input';

import { startCamera, startVideoFile as playVideoFile, stopStream } from './camera';
import { PoseContinuity, type PpcGroupInfo, type PpcGroupName, type PpcState } from './continuity';
import { createDetector, type DetectorAssets, type ModelVariant, type PoseDetector } from './detector';
import { createWorkerDetector } from './workerDetector';
import { mirrorNorm, mirrorWorld } from './mirror';
import { electProducer, type ElectionMode, type ProducerElection } from './election';
import { buildPreviewFrame, createPreviewFrame, type PreviewFrame } from './preview';
import type { LandmarkPoint, PoseFrame } from './types';

export type RuntimeState =
  | 'idle' // created, not started
  | 'electing' // producer election in flight
  | 'external' // another producer owns tracking; consume, don't capture
  | 'starting' // camera permission/stream in flight
  | 'loading-model'
  | 'running' // camera → detector live
  | 'file' // video-file → detector live (fixtures, eval)
  | 'denied' // camera permission denied — keyboard play continues
  | 'error'
  | 'stopped';

/** Eval-harness hook between mirroring and continuity (the app's masker). */
export type FrameInterceptor = (
  world: LandmarkPoint[],
  norm: LandmarkPoint[],
  videoTimeMs: number,
) => { world: LandmarkPoint[] | null; norm: LandmarkPoint[] | null; meta?: unknown };

export interface PoseRuntimeOptions {
  /** The app passes its visible element; games omit (hidden element created). */
  video?: HTMLVideoElement;
  model?: ModelVariant; // default 'lite' (games); the app passes its config
  mirror?: boolean; // default true
  ppc?: boolean; // default true
  /** Detection rate cap in Hz (0/omitted = every presented frame). Heavy
   *  models on game pages budget the main thread this way — e.g. rowing's
   *  FULL model at 15 Hz (the pose floor). */
  maxDetectHz?: number;
  /** Detect in a Web Worker (game pages): the full model costs ~30–50 ms
   *  per detection — off the main thread it stops costing game frames.
   *  Falls back to main-thread detection if the worker can't start. The
   *  Full App keeps the main-thread path (zero behavior change). */
  worker?: boolean;
  /** Worker delegate preference — best-effort: tasks-vision's CPU build
   *  can fail inside module workers ("ModuleFactory not set"), in which
   *  case the worker falls back to the other delegate. */
  workerDelegate?: 'GPU' | 'CPU';
  /** Camera capture size. Games use a smaller frame (tracking doesn't
   *  need 720p; per-detection upload/preprocess cost scales with pixels).
   *  Default 1280×720 (the app's pass-2 behavior). */
  captureSize?: { width: number; height: number };
  assets?: DetectorAssets;
  /** 'strict' = games (yield to an active producer); 'claim' = Full App. */
  election?: ElectionMode;
  /** Skip the BroadcastChannel sink (in-page consumers only). Default true. */
  broadcast?: boolean;
  channelName?: string;
  interceptor?: FrameInterceptor;
  /** A known external producer opened this page (?pp=companion): never
   *  capture; consume the remote feed. Election still applies if the
   *  remote feed dies and start() is called again. */
  forceExternal?: boolean;
}

export interface RuntimeFrame {
  /** Raw detection, pre-mirror — overlay honesty (predicted points never draw over video). */
  raw: PoseFrame | null;
  tsMs: number;
  /** Post-mirror, PRE-interceptor — the truth stream for masked eval runs. */
  truthWorld: LandmarkPoint[] | null;
  truthNorm: LandmarkPoint[] | null;
  /** Post-PPC — what every consumer enacts; null once continuity fades. */
  world: LandmarkPoint[] | null;
  norm: LandmarkPoint[] | null;
  /** Interceptor meta echo (the masker's { masked, dropped }). */
  interceptor: unknown;
  states: readonly PpcGroupInfo[];
}

export interface PoseRuntime {
  /** Elect + camera + model. Resolves to the resulting state (never throws for denial). */
  start(): Promise<RuntimeState>;
  /** Fixture/eval path: play a local file through the same pipeline. */
  startVideoFile(src: string | File): Promise<RuntimeState>;
  stop(): void;
  dispose(): void;

  state(): RuntimeState;
  onState(cb: (s: RuntimeState) => void): () => void;
  cameraError(): string | null;

  /** Trusted in-process frame tap (Full App retargeting / eval). */
  onFrame(cb: (f: RuntimeFrame) => void): () => void;

  /** Derived signals only — what games consume. */
  signals: BodySignalSource;
  core: BodyInputCore;
  lastSignal(): BodySignal | null;

  /** Approved HUD render state (in-process only; never on a transport). */
  preview: {
    latest(): PreviewFrame | null;
    subscribe(cb: (f: PreviewFrame) => void): () => void;
  };

  video: HTMLVideoElement;
  mediaStream(): MediaStream | null;

  setModel(v: ModelVariant): Promise<void>;
  setMirror(v: boolean): void;
  setPpc(v: boolean): void;
  /** Detection pause/resume (mode switches); camera keeps running. */
  pauseDetection(): void;
  resumeDetection(): void;

  poseFps(): number;
  detector(): PoseDetector | null;
  ppcStates(): readonly PpcGroupInfo[];
  /** ms since the last external producer signal (external mode; Infinity otherwise). */
  externalSignalAgeMs(): number;

  toggleTuner(host: HTMLElement): boolean;
}

let pageRuntime: PoseRuntime | null = null;

export function createPoseRuntime(opts: PoseRuntimeOptions = {}): PoseRuntime {
  if (pageRuntime) {
    throw new Error(
      'pose-runtime: a PoseRuntime already exists on this page — one tracking pipeline per page',
    );
  }

  const channelName = opts.channelName ?? DEFAULT_CHANNEL;
  const electionMode: ElectionMode = opts.election ?? 'strict';
  let mirror = opts.mirror ?? true;
  let ppcEnabled = opts.ppc ?? true;
  let modelVariant: ModelVariant = opts.model ?? 'lite';

  // hidden capture element for game pages (kept composited so rVFC fires)
  let video = opts.video ?? null;
  const ownsVideo = !video;
  if (!video) {
    video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.setAttribute('aria-hidden', 'true');
    video.style.cssText =
      'position:fixed;left:-9999px;top:0;width:2px;height:2px;opacity:0.01;pointer-events:none;';
    document.body.append(video);
  }

  // body-input protocol: landmarks go in here and only here; transports
  // carry BodySignal only (validation runs on the in-page sink; the
  // broadcast sink skips re-validation — same as the pre-extraction adapter)
  const core = createBodyInputCore();
  const inPage = createInPageChannel();
  const broadcast = opts.broadcast === false ? null : createBroadcastSink(channelName, { validate: false });

  const continuity = new PoseContinuity();
  continuity.enabled = ppcEnabled;

  let detectorInst: PoseDetector | null = null;
  let state: RuntimeState = 'idle';
  let camError: string | null = null;
  let election: ProducerElection | null = null;
  let detectionPaused = false;
  let disposed = false;

  const stateSubs = new Set<(s: RuntimeState) => void>();
  const frameSubs = new Set<(f: RuntimeFrame) => void>();
  const previewSubs = new Set<(f: PreviewFrame) => void>();

  function setState(s: RuntimeState): void {
    if (state === s) return;
    state = s;
    for (const cb of stateSubs) cb(s);
  }

  // external-producer monitoring (external mode: HUD shows remote feed +
  // its freshness; a stale remote feed lets the user hand tracking here)
  let externalBc: BroadcastChannel | null = null;
  let lastExternalAt = -Infinity;
  const onExternalMsg = (ev: MessageEvent) => {
    const d = ev.data as { t?: string } | null;
    if (d && d.t === 'bodyarcade.body-input.v1') lastExternalAt = performance.now();
  };
  function watchExternal(): void {
    if (externalBc) return;
    externalBc = new BroadcastChannel(channelName);
    externalBc.onmessage = () => {
      lastExternalAt = performance.now();
    };
    window.addEventListener('message', onExternalMsg);
    lastExternalAt = performance.now();
  }
  function unwatchExternal(): void {
    externalBc?.close();
    externalBc = null;
    window.removeEventListener('message', onExternalMsg);
  }

  // ── the frame pipeline (order preserved from the app boot) ──────────
  const mNorm: LandmarkPoint[] = [];
  const mWorld: LandmarkPoint[] = [];
  const ppcTracking: BodyTracking = {
    torso: 'visible',
    head: 'visible',
    leftArm: 'visible',
    rightArm: 'visible',
    leftLeg: 'visible',
    rightLeg: 'visible',
  };
  function currentTracking(): BodyTracking {
    for (const s of continuity.states()) {
      ppcTracking[s.name] = s.state.toLowerCase() as TrackingState;
    }
    return ppcTracking;
  }

  let lastSignal: BodySignal | null = null;
  let latencyMs: number | null = null;
  let tuner: { unmount(): void } | null = null;

  const previewA = createPreviewFrame();
  const previewGroups: Partial<Record<PpcGroupName, PpcState>> = {};
  let previewLatest: PreviewFrame | null = null;

  const frame: RuntimeFrame = {
    raw: null,
    tsMs: 0,
    truthWorld: null,
    truthNorm: null,
    world: null,
    norm: null,
    interceptor: undefined,
    states: [],
  };

  function onDetect(raw: PoseFrame | null): void {
    const tMs = raw ? raw.wallTimeMs : performance.now();
    let world: LandmarkPoint[] | null = null;
    let norm: LandmarkPoint[] | null = null;
    if (raw) {
      norm = mirror ? mirrorNorm(raw.norm, mNorm) : raw.norm;
      world = mirror ? mirrorWorld(raw.world, mWorld) : raw.world;
    }

    frame.raw = raw;
    frame.tsMs = tMs;
    frame.truthWorld = world;
    frame.truthNorm = norm;
    frame.interceptor = undefined;

    if (opts.interceptor && world && norm && raw) {
      const r = opts.interceptor(world, norm, raw.videoTimeMs);
      world = r.world;
      norm = r.norm;
      frame.interceptor = r.meta;
    }

    // Predictive Pose Continuity: may briefly carry the stream through an
    // occlusion (decaying confidence) or synthesize through a short full
    // dropout; null once faded — every consumer inherits it
    const cont = continuity.apply(world, norm, tMs);
    frame.world = cont ? cont.world : null;
    frame.norm = cont ? cont.norm : null;
    frame.states = continuity.states();

    // derived signals: PRE-smoothing landmarks in, BodySignal out
    lastSignal = core.push({
      tsMs: tMs,
      world: frame.world,
      norm: frame.norm,
      tracking: ppcEnabled ? currentTracking() : undefined,
    });
    inPage.sink.publish(lastSignal);
    broadcast?.publish(lastSignal);
    latencyMs = performance.now() - tMs;

    for (const cb of frameSubs) cb(frame);

    for (const g of frame.states) previewGroups[g.name] = g.state;
    previewLatest = buildPreviewFrame(
      previewA,
      frame.norm,
      tMs,
      previewGroups,
      lastSignal.confidence,
      raw !== null,
    );
    for (const cb of previewSubs) cb(previewLatest);
  }

  async function ensureDetector(): Promise<PoseDetector> {
    if (detectorInst) return detectorInst;
    setState('loading-model');
    detectorInst = opts.worker
      ? await createWorkerDetector(modelVariant, opts.assets, opts.workerDelegate)
      : await createDetector(modelVariant, opts.assets);
    if (opts.maxDetectHz) detectorInst.setMaxHz(opts.maxDetectHz);
    return detectorInst;
  }

  let detecting = false;
  function startDetection(): void {
    if (!detectorInst || detectionPaused || detecting) return;
    detecting = true;
    detectorInst.start(video!, onDetect);
  }

  async function ensureElection(): Promise<'producer' | 'external'> {
    if (election) return election.role;
    setState('electing');
    election = await electProducer(electionMode, channelName);
    return election.role;
  }

  const api: PoseRuntime = {
    async start() {
      if (disposed) return state;
      // callable again from 'file' (back to camera) and from every
      // terminal state (denied retry, external takeover); no-op while live
      if (state === 'running' || state === 'starting') return state;
      if (opts.forceExternal && state === 'idle') {
        watchExternal();
        setState('external');
        return state;
      }
      // re-entry from external (remote feed went quiet): re-run election
      if (election?.role === 'external' || state === 'external') {
        election?.release();
        election = null;
        unwatchExternal();
      }
      const role = await ensureElection();
      if (role === 'external') {
        watchExternal();
        setState('external');
        return state;
      }
      setState('starting');
      camError = null;
      try {
        await startCamera(video!, opts.captureSize);
      } catch (err) {
        camError = err instanceof Error ? err.message : String(err);
        election?.release();
        election = null;
        const denied = err instanceof DOMException &&
          (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError');
        setState(denied ? 'denied' : 'error');
        return state;
      }
      try {
        await ensureDetector();
      } catch (err) {
        camError = err instanceof Error ? err.message : String(err);
        stopStream(video!);
        election?.release();
        election = null;
        setState('error');
        return state;
      }
      continuity.reset();
      startDetection();
      setState('running');
      return state;
    },

    async startVideoFile(src) {
      if (disposed) return state;
      await ensureElection(); // claim-mode app; file playback still produces
      await playVideoFile(video!, src);
      await ensureDetector();
      continuity.reset();
      startDetection();
      setState('file');
      return state;
    },

    stop() {
      detecting = false;
      detectorInst?.stop();
      stopStream(video!);
      election?.release();
      election = null;
      unwatchExternal();
      setState('stopped');
    },

    dispose() {
      api.stop();
      disposed = true;
      tuner?.unmount();
      inPage.sink.close();
      inPage.source.close();
      broadcast?.close();
      if (ownsVideo) video!.remove();
      stateSubs.clear();
      frameSubs.clear();
      previewSubs.clear();
      if (pageRuntime === api) pageRuntime = null;
    },

    state: () => state,
    onState(cb) {
      stateSubs.add(cb);
      return () => stateSubs.delete(cb);
    },
    cameraError: () => camError,

    onFrame(cb) {
      frameSubs.add(cb);
      return () => frameSubs.delete(cb);
    },

    signals: inPage.source,
    core,
    lastSignal: () => lastSignal,

    preview: {
      latest: () => previewLatest,
      subscribe(cb) {
        previewSubs.add(cb);
        return () => previewSubs.delete(cb);
      },
    },

    video: video!,
    mediaStream: () => (video!.srcObject as MediaStream | null) ?? null,

    async setModel(v) {
      modelVariant = v;
      if (detectorInst) await detectorInst.setModel(v);
    },
    setMirror(v) {
      if (mirror === v) return;
      mirror = v;
      continuity.reset();
    },
    setPpc(v) {
      ppcEnabled = v;
      continuity.enabled = v;
      continuity.reset();
    },
    pauseDetection() {
      detectionPaused = true;
      detecting = false;
      detectorInst?.stop();
    },
    resumeDetection() {
      if (!detectionPaused) return;
      detectionPaused = false;
      startDetection();
    },

    poseFps: () => detectorInst?.poseFps() ?? 0,
    detector: () => detectorInst,
    ppcStates: () => continuity.states(),
    externalSignalAgeMs: () =>
      state === 'external' ? performance.now() - lastExternalAt : Infinity,

    toggleTuner(host) {
      if (tuner) {
        tuner.unmount();
        tuner = null;
        return false;
      }
      tuner = mountTuner(host, { core, source: inPage.source, getLatencyMs: () => latencyMs });
      return true;
    },
  };

  pageRuntime = api;
  return api;
}

/** Test hook: clears the page-singleton guard (unit environments only). */
export function __resetPoseRuntimeSingleton(): void {
  pageRuntime = null;
}
