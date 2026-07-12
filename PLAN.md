# PLAN — V7 Demo Director v2 (feat/recording-v2, worktree wt-recording)

Base: `ab627800` (V6 Motion Memory 2 — loop schema v2 declared stable, so
replay-insertion work is unblocked from day one). Baseline suite on this
tree: 116 passed / 9 skipped (private avatar models + hand-fixture skips,
both expected) / 2 failed — the two documented SwiftShader-only
detect.spec environment failures (`.local/v7-baseline.log`), identical to
the V6 exit state. No regressions to inherit.

## Reading of the existing stack (audit)

- `src/record/recorder.ts` — composite recorder: camera(+skeleton) pane +
  stage pane → canvas → captureStream(30) → MediaRecorder. Two aspect
  layouts (16:9 side-by-side, 9:16 stacked), title stinger / end card /
  badge / grade already ship. **Extend, don't rebuild**: the pane
  compositing becomes presentation-aware; everything else stays.
- `src/director/director.ts` + `scripts.ts` — framing check → 3-2-1
  countdown → shot-by-shot serif overlay; scripts are data; hands-free
  start/advance/stop via `src/gesture/intent.ts` (raise-arms / hold-still
  / cross-wrists) with keyboard fallback. Tests pin the whole flow
  (`tests/director.spec.ts`). V7 adds per-shot presentation presets and
  replay/slow-mo steps — same machinery.
- `src/memory/*` — schema-v2 loops; `GhostPlayer` already supports
  `rate` and `placement: 'center'`; `instantReplay()` in main.ts already
  does slow-mo + side camera. The replay take-step reuses exactly this.
- Detection: Full App detects pose on the main thread; V1 established the
  worker-detection pattern (and its lesson: MediaPipe GPU delegate
  contends with the page's GPU process).

## Segmentation spike (measured, `.local/seg-spike-{headless,gpu}.json`)

Model: MediaPipe selfie segmenter (Apache-2.0 Google, same family as the
pose/hand models; → ASSETS.md). Headed on :2 (RTX, real numbers), inline
on the main thread, fullbody fixture, 90 frames per config:

| model      | width | delegate | avg ms | p95 ms | flicker |
|------------|-------|----------|--------|--------|---------|
| landscape  | 256   | GPU      | 74.7   | 414.8  | .0084   |
| landscape  | 160   | GPU      | 16.8   | 53.2   | .0040   |
| square     | 256   | GPU      | 35.0   | 152.5  | .0076   |
| landscape  | 256   | CPU/wasm | 15.6   | 42.0   | .0043   |
| landscape  | 160   | CPU/wasm | 12.1   | 22.6   | .0038   |

Verdict: **CPU (XNNPACK wasm) beats the GPU delegate** for this tiny
model and has far better tails — the GPU delegate contends with the
page's own rendering (same failure V1 saw). And 12–16 ms inline is still
too much main-thread time at 24 Hz, so:

**Architecture: segmentation runs in a dedicated worker with the CPU
delegate** (V1's worker-detector pattern): main thread pays
`createImageBitmap(video, {resizeWidth})` + one transferable
`Float32Array` back per mask; smoothing (MaskBuffer EMA + soft threshold,
~36k px) stays on the main thread at ~0.2 ms. No GPU contention at all.

## File ownership (V7 owns; nothing else is touched)

- NEW `packages/segmentation/` — segmenter (inline + worker), MaskBuffer.
- NEW `src/record/presentation.ts` — presentation renderer + degradation
  controller (consumes mask, draws styled camera output for preview pane
  and recorder panes).
- `src/record/recorder.ts`, `src/director/director.ts`,
  `src/director/scripts.ts` — extended as above.
- `src/config.ts` (new keys), `src/main.ts` (wiring), `index.html` +
  `src/styles.css` (presentation control in the take bar, preview canvas
  — current visual language, no redesign), `src/ui/receipt.ts` copy nudge
  if needed.
- Root configs: vite/tsconfig alias for the new package;
  `scripts/fetch-pose-model.mjs` adds the two segmenter models.
- NEW tests `tests/segmentation.spec.ts`; NEW `eval/seg-spike.mjs` (this
  spike), `eval/seg-quality.mjs` (IoU + flicker), `eval/rec-perf.mjs`
  (ON/OFF × both aspects), `eval/demo-takes.mjs` (evidence recordings);
  labels in `eval/seg-labels/`.
- Docs: `docs/RECORDING.md` (new), README privacy line, ASSETS.md,
  DECISIONS.md, EVAL_NOTES.md, STATUS.md, FINAL_USER_TEST_PLAN.md §S6.

Not touched: `packages/pose-runtime` (no interface changes needed —
segmentation is fully parallel), memory/* (consumed as-is), V5/V6 files.

## Presentation modes (the layer, O1)

Camera-pane treatments, all driven by the same low-res smoothed mask:
1. `blur` — background defocused (downscale-upscale blur, not
   ctx.filter, per frame budget), performer sharp on top.
2. `cutout` — performer over a dark stage-glass backdrop (design hue).
3. `silhouette` — performer as a luminous flat fill (the design's cyan),
   skeleton optionally inside.
4. `chip` — stage goes full-frame; performer cutout lives in a small
   picture-in-picture chip, bottom corner, hairline border.
Plus the signature: `stage` — stage full-frame, performer **cutout
composited onto the stage floor beside the avatar** (2D composite,
floor-aligned, subtle contact shadow). `skeleton` is an orthogonal
toggle: the tracked skeleton glows on top of the cutout body.
`raw` = today's behavior, and the fallback when segmentation degrades.

Live preview: when a mode is active and not recording, the presentation
renders into a preview canvas over the camera feed (chrome hides during
recording anyway, so preview and composite never both run).

## Degradation tiers (the frame budget is a floor, not a hope)

- T0: worker seg 24 Hz, working width 256.
- T1: worker seg 12 Hz, working width 160 (spike: 12 ms worker-side).
- T2: segmentation off — every mode falls back to `raw` camera pane
  (blur-off rule), coach explains in instrument language.
Controller: rolling render-fps window; below floor (45) for >2 s → drop a
tier; recovery is manual-or-slow (no oscillation: 20 s cooldown before
stepping back up, one tier at a time). Tier changes are logged to `__PP`
for tests; a mask older than 400 ms is treated as missing (T2 behavior)
so a stalled worker can never freeze the performer.

## Take scripts v2 (O2)

`Shot` gains `present?` (presentation preset applied for that shot,
restored after the take) and `action: 'replay'` — the shot plays the last
few seconds via Motion Memory ghosts (placement 'center', slow-mo rate
0.5; capture window sized so `rate × shot.sec` fits). New/updated
scripts: Character take gains a replay closer; new **Presentation reel**
(raw → blur → cutout → silhouette → stage across shots); new **Cutout
duet** (ghost duet with the performer cutout on stage). Countdown,
hands-free start/advance/stop, framing check: unchanged machinery, must
stay green.

## Verification

- Unit: MaskBuffer (EMA lowers flicker vs raw, band mapping, coverage),
  degradation controller state machine.
- e2e: each presentation mode records a nonzero playable file at both
  aspects; per-shot preset switching observed via `__PP`; director suite
  (hands-free) untouched and green; replay step produces ghost activity.
- Mask quality: `eval/seg-quality.mjs` — IoU vs hand-labeled polygon
  masks on fixture frames (target mean ≥ 0.55 — labels are rough
  polygons), smoothed edge-flicker < 0.02 mean per frame.
- Perf: `eval/rec-perf.mjs` headed on :2 under the display lock —
  recording active, seg OFF vs ON (cutout), both aspects; floors: render
  ≥ 45 fps, pose ≥ 20 Hz, with the ON/OFF delta tabled in EVAL_NOTES.
- Evidence: `eval/demo-takes.mjs` records one automated take per
  presentation mode (incl. the cutout-on-stage signature) into
  `.local/takes/v7/` with per-shot preset assertions + screenshots.
- Suites: full root suite green (minus the two documented SwiftShader
  env failures) before the final commit, under the full-suite lock.

## Risks

- Selfie-segmenter quality on full-body framing (model is selfie-tuned):
  mitigated by soft threshold + temporal EMA; measured honestly by the
  IoU eval; documented as a limitation if legs/feet read weak.
- Worker bitmap traffic on weak machines: tier system exists precisely
  for this; T2 is always safe.
- 9:16 pane sizes change per mode (chip/stage layouts): covered by the
  both-aspects e2e recordings.
