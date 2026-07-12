# PLAN — V6 Motion Memory 2 (feat/motion-memory-2)

Lane: worktree `../wt-motionmem`, tmux `ba-mm2`, port 5178, display :2 (light).
Scope: upgrade Motion Memory v1 into the creative loop library. Playback only.

## Reading of v1 (audit)

v1 is small and sound: `src/memory/stream.ts` (quantized landmark loop +
ring buffer), `src/memory/store.ts` (IndexedDB, DB `posepuppet-memory` v1),
`src/memory/ghost.ts` (ghost player: duet/echo/replay through a second
Retargeter). The critical v1 design decision carries the whole pass: a loop
stores the retargeting pipeline's INPUT (quantized mirrored/smoothed
landmarks), not per-bone quaternions — replaying through any avatar's own
Retargeter makes re-skin exact by construction. Every v2 feature builds on
that; nothing is rewritten.

## Loop schema v2 (RFC — becomes the stable contract V7 depends on)

```ts
interface LoopFrame { t: number; q: Int16Array }   // unchanged from v1

interface MotionLoop {
  v: 2;                       // v1 records have no `v` field
  id: string;                 // unchanged (v1 ids survive migration)
  name: string;
  kind: 'pose' | 'hand';
  createdAt: number;          // epoch ms
  durationMs: number;
  frames: LoopFrame[];        // v1 quantization, unchanged
  avatar: string;             // avatar id at capture; 'unknown' when migrated
  mode: 'character' | 'hand'; // app mode at capture; derived from kind on migration
  thumbSvg: string;           // deterministic SVG skeleton, highest-energy frame
  bytes: number;              // storage accounting (frame buffers + fixed overhead)
}
```

Invariants (the part V7 may rely on):
- `frames` stay quantized landmark streams; playback is always
  landmarks → Retargeter. Never quaternions, never video.
- Trim is destructive-on-apply: applying a trim rewrites `frames`
  (re-timed from 0) and `durationMs`. No trim markers in the schema, so
  every consumer stays version-blind about editing state.
- Mirror is a playback option, never stored data.
- Derived data (energy curve) is computed on demand, never persisted;
  the thumbnail is the one precomputed derivative (for library cards).
- Storage is bounded: total bytes cap + loop-count cap enforced at save
  with oldest-first eviction after an explicit user prompt.

Migration: IndexedDB version 1→2. `onupgradeneeded` rewrites v1 records in
place: `v:2`, `avatar:'unknown'`, `mode` from `kind`, computed `thumbSvg`
and `bytes`. Ids, names, timestamps, frames untouched — old loops keep
playing bit-identically.

## Energy metric (documented here + docs/MOTION_MEMORY.md)

Per frame i (decoded world landmarks), energy
`E_i = Σ_j |θ_j(i) − θ_j(i−1)| / Δt` — summed joint angular speed (rad/s)
over the tracked joint set: pose = interior angles at both elbows,
shoulders, hips, knees (8 joints); hand = the 5 finger-bend angles
(wrist→MCP→tip) plus palm-normal rotation. Uses:
- thumbnail frame = argmax `E_i`
- best-last-motion = argmax mean energy over a sliding ~5 s window
- motion-tape strip = the `E_i` curve over time

## Mirror (sagittal reflection)

Implemented in landmark space, where the loops live: negate world x,
reflect norm x (x→1−x), and swap every left/right landmark index pair.
Fed through the Retargeter this produces exactly the sagittal-plane
quaternion reflection on the rig — with correct handedness by
construction rather than by per-bone axis fixes. Verified with an
asymmetric-gesture fixture stream: a right-hand wave must replay as a
true left-hand wave (bone-trajectory sync metric against a ground-truth
left-wave render). Hand-kind loops mirror by the same x reflection.

## File ownership (V6-exclusive)

- `src/memory/*` — stream/store/ghost (extended) + new `energy.ts`,
  `mirror.ts`, `thumbnail.ts`, `trim.ts`, `library.ts`
- `tests/memory.spec.ts` (extended), `tests/memory-library.spec.ts` (new)
- `docs/MOTION_MEMORY.md` (new)

Shared files, additive memory-scoped edits only (declared for V1/V5 rebase):
- `src/main.ts` — ONLY inside the existing “Motion Memory UI” block plus
  memory entries in the palette command array. No shell/boot/camera/
  retarget/record edits.
- `index.html` — ONLY the Memory rail section / memory buttons.
- `src/styles.css` — one appended `.mml-*` block.

Not touched: `src/record/*`, `src/director/*` (V7), `src/rig/*`,
capability metadata (V5), runtime/boot/camera (V1), `packages/*`.

## Outcomes → implementation

- O1 schema v2 + migration + bounded store; library overlay: cards with
  SVG thumbnail, name (inline rename), duration · avatar · mode · date,
  play/delete.
- O2 trim: in/out handles on the motion tape, live ghost preview of the
  trimmed range, apply rewrites frames; “best last motion” grabs the
  highest-energy ~5 s window from the 12 s ring (and a “best 5 s” snap
  inside the editor).
- O3 playback: duet / echo chorus (existing) + mirror toggle on any
  playback; ghost opacity presets and echo-delay presets, live.
- O4 motion-tape strip: energy-over-time canvas, scrub-to-trim; docs;
  FINAL_USER_TEST_PLAN S5 entries; STATUS.md schema-stability declaration.

## Verification map

- save→reload→replay within v1 tolerance — browser spec against real
  IndexedDB (Chromium), replay compared via the existing round-trip metric.
- migration on real v1 records — seed DB v1 with v1-shaped records (the
  v1 writer preserved in the test), reopen through v2, assert fields +
  bit-identical frames + replay tolerance.
- mirror handedness — unit spec: asymmetric right-hand wave, mirrored
  replay vs ground-truth left-wave render, mean/max bone-angle bounds;
  plus left/right bone role swap asserted.
- trim boundary exactness — unit spec: exact kept-frame set, re-timing,
  duration, idempotence.
- deterministic thumbnails — same loop → identical SVG string, twice,
  and across reload.
- storage bound — small injected caps; save past cap prompts, eviction
  removes oldest first, refusal keeps store intact.
- suites green — full root Playwright suite on 5178 (SwiftShader),
  diffed against the pre-change baseline (.local/mm2-baseline.log).
