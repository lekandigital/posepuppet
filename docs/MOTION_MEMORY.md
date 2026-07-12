# Motion Memory — loop schema v2 and the library layer

V6 (Motion Memory 2) upgraded the v1 ring-buffer/ghost system into a
creative loop library. This document is the stable contract: **V7
(Recording v2) may build replay insertion on everything in “Schema v2”
and “Invariants” below.** Announced stable in status.md (2026-07-12).

## Schema v2 (persisted in IndexedDB `posepuppet-memory`, DB version 2)

```ts
interface LoopFrame {
  t: number;      // ms since loop start
  q: Int16Array;  // quantized landmarks — pose: world 33×4 (x,y,z,vis)
                  // + norm 33×3; hand: norm 21×3
}

interface MotionLoop {
  v: 2;                       // v1 records have no `v` field
  id: string;                 // v1 ids survive migration
  name: string;
  kind: 'pose' | 'hand';
  createdAt: number;          // epoch ms
  durationMs: number;
  frames: LoopFrame[];        // quantization unchanged from v1
  avatar: string;             // avatar id at capture; 'unknown' if migrated
  mode: 'character' | 'hand'; // app mode at capture; from kind if migrated
  thumbSvg: string;           // deterministic SVG skeleton (see Thumbnails)
  bytes: number;              // storage accounting (loopBytes())
}
```

Quantization (unchanged from v1): world ±4 m → int16 (scale 8000), norm
and visibility → int16 (scale 16000). ~462 B/frame pose, ~126 B/frame
hand; an 8 s pose loop at 30 Hz is ~110 KB.

`LoopCapture` (the same shape minus the v2 fields) is what the ring
buffer emits and what every playback path consumes; `finalizeLoop(capture,
avatar, mode)` promotes a capture to a persistable v2 loop.

## Invariants (the part V7 can rely on)

- **Bone streams, not video.** `frames` are quantized landmark streams —
  the recorded INPUT of the retargeting pipeline. Playback is always
  landmarks → a `Retargeter` bound to the target rig, so any loop
  performs on any roster avatar (re-skin is exact by construction).
- **Trim is destructive-on-apply.** Applying a trim rewrites `frames`
  (re-timed from 0) and `durationMs`, then re-finalizes thumbnail and
  bytes. There are no trim markers in the schema; a trimmed loop is
  indistinguishable from one recorded that short.
- **Mirror is a playback option, never stored data.** No schema field
  records mirroring.
- **Derived data is computed on demand.** The energy curve is never
  persisted; `thumbSvg` is the single precomputed derivative.
- **Storage is bounded.** `saveLoopBounded` enforces
  `DEFAULT_CAPS = { maxBytes: 32 MiB, maxLoops: 64 }` with oldest-first
  eviction behind an explicit user prompt. Nothing is deleted — and the
  new loop is not saved — unless the prompt is accepted.
- **Local only.** IndexedDB, structured-clone Int16Arrays, no
  serialization, no network. Playback only — never scored, never
  gamified.

## Migration (v1 → v2)

`onupgradeneeded` (DB 1 → 2) rewrites v1 records in place: `v: 2`,
`avatar: 'unknown'`, `mode` derived from `kind`, `thumbSvg` and `bytes`
computed. Ids, names, timestamps and frame bytes are untouched — old
loops keep playing bit-identically (pinned by
`tests/memory-library.spec.ts` on seeded real-shape v1 records).

## Motion energy (the one derived metric)

Per frame *i*, with decoded world landmarks:

```
E_i = Σ_j |θ_j(i) − θ_j(i−1)| / Δt      [rad/s]
```

summed joint angular speed over a fixed joint set:

- **pose** (8 joints): the interior angles at both elbows, both
  shoulders, both hips, both knees (angle at the middle point of each
  a–b–c triple, e.g. shoulder–elbow–wrist). Joints whose triple contains
  a landmark with visibility ≤ 0.3 contribute nothing for that frame, so
  occlusion noise never reads as motion.
- **hand** (5 joints): the five finger-bend angles (wrist → mid-finger →
  tip).

Uses:
- **Thumbnail frame** = argmax `E_i`.
- **Best last motion** = the ~5 s window with the highest mean energy
  (sliding-window mean; candidate windows are always exactly the window
  width and lie inside the loop, so an early burst yields a full window
  containing it, never a clipped sliver).
- **Motion-tape strip** = the `E_i` curve over time, drawn behind the
  trim handles.

## Mirror playback

Sagittal-plane reflection expressed in landmark space, where the loops
live: negate world x, reflect norm x (x → 1 − x), and swap every
left/right landmark index pair. Fed through the Retargeter this yields
exactly the sagittal-plane quaternion reflection on the rig — handedness
is correct by construction. Verified in `tests/memory.spec.ts` with an
asymmetric right-hand-wave stream: the mirrored replay matches a
ground-truth left-hand-wave render (mean bone-trajectory error < 5°,
max < 12°), the left arm carries the wave, and mirroring twice returns
the original frames. Hand loops mirror by x reflection alone.

## Trim contract

`trimLoop(loop, inMs, outMs)`: kept frames are exactly those with
`t ∈ [inMs, outMs]`, re-timed by `−inMs`; `durationMs = outMs − inMs`;
handles normalize if reversed; windows shorter than `MIN_TRIM_MS`
(400 ms) or holding fewer than `MIN_TRIM_FRAMES` (4) refuse (null).
Frame buffers are shared, not copied. Exactness pinned in
`tests/memory.spec.ts`.

## Thumbnails

`loopThumbnail` renders the highest-energy frame's norm landmarks as an
SVG skeleton string (fixed segment set, fixed 0.1-px rounding, violet
`#9d7bff`). Pure string assembly from quantized data — deterministic
byte-for-byte, pinned by tests. No canvas, no GPU, no video.

## Surfaces

- Library overlay (`src/memory/library.ts`): cards (thumb, inline
  rename, duration · avatar · mode · date, play/tape/delete with
  two-click confirm), motion-tape editor (energy strip, drag-to-trim
  handles, live trimmed preview on the ghost, best-5 s snap, apply),
  playback controls (mirror toggle; ghost opacity presets faint/half/
  solid; echo-delay presets tight/beat/wide). Open via the Memory rail
  “library” button, ⌘K, or `l`.
- “Best 5 s” rail button / ⌘K “grab best last motion”: saves the
  highest-energy ~5 s window of the last 12 s ring.
- v1 surfaces unchanged: ghost duet (g), echo chorus slider, instant
  replay (i), rail loop list.

## Known limits

- Hand-kind loops persist and migrate but have no replay surface yet
  (the ghost player drives body rigs); their card says so. Replay
  through hand puppets arrives with Recording v2.
- The energy metric reads joint angles, not root translation — a person
  walking rigidly across frame scores low. Fine for a puppet stage.
