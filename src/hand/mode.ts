// Hand-only mode orchestrator: owns the HandLandmarker, the puppet roster,
// and the camera-overlay hand skeleton. A first-class mode beside
// Character — its own stage treatment, its own roster cards.

import * as THREE from 'three';
import {
  createHandDetector,
  HAND_CONNECTIONS,
  type HandDetector,
  type HandFrame,
} from '@bodyarcade/pose-runtime';
import type { HandPuppet, HandPuppetDef, HandPuppetId } from './types';
import { createExpressiveHand } from './puppets/expressiveHand';
import { createBeaky } from './puppets/beaky';
import { createXray } from './puppets/xray';

export const HAND_PUPPETS: HandPuppetDef[] = [
  {
    id: 'hand',
    label: 'hand',
    glyph: '✋',
    chip: 'Hand-only',
    note: 'true 21-point finger tracking',
    create: createExpressiveHand,
  },
  {
    id: 'beaky',
    label: 'beaky',
    glyph: '◗',
    chip: 'Hand-only',
    note: 'pinch opens the beak — talk with it',
    create: createBeaky,
  },
  {
    id: 'xray',
    label: 'x-ray',
    glyph: '◇',
    chip: 'Hand-only',
    note: 'your tracked hand as a glowing wireframe',
    create: createXray,
  },
];

export function isHandPuppetId(v: string): v is HandPuppetId {
  return HAND_PUPPETS.some((d) => d.id === v);
}

export interface HandMode {
  readonly object: THREE.Group;
  readonly active: boolean;
  start(video: HTMLVideoElement): Promise<void>;
  stop(): void;
  setPuppet(id: HandPuppetId): void;
  puppetId(): HandPuppetId;
  handFps(): number;
  lastDetectionAt(): number;
  detectionCount(): number;
  /** beaky's eval signals; null when another puppet is live */
  beakySignals(): { pinch: number; jaw: number } | null;
  /** hook for the eval collector: called once per hand-detection frame */
  onFrameHook: ((frame: HandFrame | null) => void) | null;
  drawOverlay(ctx: CanvasRenderingContext2D, w: number, h: number): void;
  tick(dt: number, time: number): void;
}

export function createHandMode(): HandMode {
  const object = new THREE.Group();
  object.name = 'hand-mode';

  let detector: HandDetector | null = null;
  let puppet: HandPuppet | null = null;
  let currentId: HandPuppetId = 'beaky';
  let active = false;
  let lastFrame: HandFrame | null = null;
  let lastAt = 0;
  let count = 0;

  function mountPuppet(id: HandPuppetId): void {
    puppet?.dispose();
    const def = HAND_PUPPETS.find((d) => d.id === id) ?? HAND_PUPPETS[1];
    currentId = def.id;
    puppet = def.create();
    object.add(puppet.object);
  }

  const api: HandMode = {
    object,
    get active() {
      return active;
    },
    onFrameHook: null,
    async start(video) {
      if (!puppet) mountPuppet(currentId);
      detector ??= await createHandDetector();
      active = true;
      detector.start(video, (frame) => {
        if (frame) {
          lastFrame = frame;
          lastAt = frame.wallTimeMs;
          count++;
        } else {
          lastFrame = null;
        }
        puppet?.onHandFrame(frame);
        api.onFrameHook?.(frame);
      });
    },
    stop() {
      active = false;
      detector?.stop();
      lastFrame = null;
    },
    setPuppet(id) {
      mountPuppet(id);
    },
    puppetId: () => currentId,
    handFps: () => detector?.handFps() ?? 0,
    lastDetectionAt: () => lastAt,
    detectionCount: () => count,
    beakySignals() {
      const b = puppet as (HandPuppet & { jawAngle?: () => number; pinchNorm?: () => number }) | null;
      if (!b?.jawAngle || !b.pinchNorm) return null;
      return { pinch: b.pinchNorm(), jaw: b.jawAngle() };
    },
    drawOverlay(ctx, w, h) {
      ctx.clearRect(0, 0, w, h);
      if (!lastFrame) return;
      const n = lastFrame.norm;
      ctx.strokeStyle = 'rgba(63,224,255,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (const [a, b] of HAND_CONNECTIONS) {
        ctx.moveTo(n[a].x * w, n[a].y * h);
        ctx.lineTo(n[b].x * w, n[b].y * h);
      }
      ctx.stroke();
      ctx.fillStyle = 'rgba(200,255,223,0.95)';
      for (const p of n) {
        ctx.beginPath();
        ctx.arc(p.x * w, p.y * h, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    tick(dt, time) {
      puppet?.update(dt, time);
    },
  };
  return api;
}
