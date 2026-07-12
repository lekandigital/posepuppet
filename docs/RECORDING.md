# Recording v2 — Demo Director (V7)

The recorder's job moved from *capture* to *production*: the app composes
the public clip — presentation-treated camera, guided shots, in-take
instant replay, title/end cards — with everything, including person
segmentation, computed locally in the browser.

## Performer presentation (person segmentation)

Six camera treatments, selectable from the take bar (`CAM` group), the
palette (`x` cycles), or per shot in a take script:

| mode | what the clip shows |
|---|---|
| `RAW` | plain camera + skeleton overlay (the classic composite) |
| `BLUR` | background defocused, performer sharp |
| `CUT` | background removed — performer on dark glass |
| `SIL` | performer as a luminous cyan-violet silhouette |
| `CHIP` | stage full-frame; performer cutout in a corner body chip |
| `STAGE` | **the signature**: performer cutout on the stage floor beside the avatar, contact shadow included |
| `SKEL` | orthogonal toggle: the tracked skeleton glows on the cutout body |

When a non-raw mode is active (and you're not recording), a live preview
renders over the camera panel so you see exactly what the clip will show.

### How it works

- `packages/segmentation` wraps MediaPipe's selfie segmenter
  (`selfie_segmenter_landscape.tflite`, Apache-2.0, fetched postinstall
  next to the pose models — ASSETS.md). All inference is in-browser;
  masks never leave the page. The privacy receipt applies unchanged.
- Inference runs in a **classic worker** (`public/seg-worker.js`) with
  the **CPU/XNNPACK delegate** — measured faster than the GPU delegate
  for this tiny model (15.6 ms vs 74.7 ms avg @256 px on the eval box)
  and free of GPU-process contention with the three.js stage. A classic
  worker (not a module worker) because MediaPipe's wasm-loader import
  breaks under the Vite dev server's module transform; `importScripts`
  is bundler-proof. The main thread only pays `createImageBitmap`
  (downscaled at creation) plus one transferred `Float32Array` per mask.
- The video is downscaled to a **256 px working width** before
  inference; the resulting low-res confidence mask is EMA-smoothed per
  pixel with a soft threshold band (`MaskBuffer`) to kill edge flicker,
  then upscaled with a feathering blur at composite time.
- Mask quality is measured, not assumed: `node eval/seg-quality.mjs`
  computes IoU against hand-labeled person polygons on fixture frames
  and the smoothed edge-flicker rate (`eval/seg-quality.json`; gates:
  frame IoU ≥ 0.45, mean ≥ 0.55, flicker < 0.02).

### Degradation tiers (blur-off before the floor breaks)

A `TierController` watches render fps whenever a non-raw mode is
requested (toggle: "auto quality" in the palette):

- **T0** — 24 Hz segmentation, 256 px working width
- **T1** — 12 Hz, 160 px (after 2 s below the 45 fps floor)
- **T2** — segmentation off; every mode falls back to the raw camera
  pane and the coach explains. Recovery is deliberate: 20 s cooldown,
  4 s of sustained headroom, one tier at a time — no oscillation.

Two more safety rails, independent of the tiers: a mask older than the
freshness window (400 ms on healthy machines; widens with the measured
mask interval on slow ones, capped at 2 s) is treated as missing, so a
stalled worker can never freeze the performer mid-take; and the
composite layout follows the *effective* mode per frame with a 600 ms
debounce, so chip/stage layouts never flap on brief mask gaps.

## Take scripts v2

Scripts are still data (`src/director/scripts.ts`). New per-shot fields:

- `present` — presentation preset for that shot (restored when the take
  ends; unset means "the performer's own setting").
- `skeleton` — skeleton-ghost overlay during the shot.
- `action: 'replay'` — the shot IS an instant replay: the last seconds
  play in slow motion (rate 0.5) through Motion Memory ghosts from a
  side camera angle, sized so the replay fills the shot — recorded into
  the same take. Stillness-advance is disabled during replay shots (you
  are *supposed* to stand still and watch).

Shipped scripts: **Character take** (now closes on a replay), **Ghost
duet**, **Cutout duet** (the performer cutout on stage beside avatar and
ghost), **Presentation reel** (raw → blur → cutout → silhouette →
stage across five shots), **Talking puppet** (hand mode).

Countdown, pre-take framing check, and hands-free control are unchanged:
raise both arms ~1 s to start, hold a pose to advance, cross wrists to
stop; space/esc always work.

## Packaging

Title stinger (serif mark + take name), end card ("ALL INFERENCE LOCAL —
NOTHING UPLOADED" + take name), corner badge, grain/vignette grade — all
toggleable, both aspects (16:9 side-by-side, 9:16 stacked vertical).
Chip/stage presentations render the stage full-bleed in both aspects.

## Verification

- `tests/segmentation.spec.ts` — TierController units, MaskBuffer units
  (EMA vs raw flicker, band mapping, bbox), every presentation mode
  records a nonzero playable file (16:9 all modes, 9:16 cutout/stage),
  per-shot presets apply and restore through the Presentation reel, the
  replay shot drives ghosts inside a take.
- `eval/seg-quality.mjs` — mask IoU + flicker gates (see above).
- `eval/rec-perf.mjs` — render/pose rates with segmentation OFF vs ON at
  both aspects **while recording**, floors asserted on headed GPU runs.
- `eval/demo-takes.mjs` — records one evidence clip per presentation
  mode plus the scripted Presentation reel and Cutout duet takes into
  `.local/takes/v7/` (gitignored — fixture footage) with poster frames
  in `.local/shots/v7/`.
- `eval/seg-spike.mjs` — the delegate/model/resolution matrix behind the
  CPU-worker decision (`.local/seg-spike-*.json`).
