# CP10 — Dolphin controls, movement feel and chase camera: completion report

_Branch `bodyarcade-tidewater-cp10-controls-camera` (review branch off `bodyarcade-tidewater-cp10` @
`93b84d5937a51d48ef24d5140312a6c6317da438`), 2026-11-04, Claude Code cloud session. A camera, controls
and movement-quality pass over `apps/tidewater-dolphin/`; no environment migration, no CP11. The vendored
Tidewater tree (pinned `4811ba4`) is byte-identical (SHA-256 manifest re-verified, see §11)._

## 1. State of the starting commit

`93b84d5` ("surface waterline chase camera and Ecco-style swim controls") described a hold-to-swim
scheme, charge, three camera styles and a near-surface chase eye. Inspection found it incomplete in
three ways that a human would have met before anything else:

| Finding | Evidence | Effect |
|---|---|---|
| **The game did not boot.** `DolphinPlayer`'s constructor called `applyControlPrefs()` (which touches `this.rig`) before the rig was constructed. | Loading the page in a WebGPU browser stops at "Waking the dolphin…" with `Cannot read properties of undefined (reading 'setStyle')` (reproduced headlessly). | Fatal. |
| **It did not type-check.** `lastHeight` inferred the literal type `1.1` from the `as const` table; an unused import. | `tsc --noEmit`: 2 errors, so `npm run build` failed. | Build broken. |
| **The headline camera change was inert.** `chaseHeight()` called the engine's `smoothstep(x, min, max)` in GLSL order `(edge0, edge1, x)`, so the surface skim never engaged. | Its own unit tests failed 3/35: the eye sat **+0.70 m above the surface** over a dolphin at its ceiling — exactly the "waves carried the lens instead of crossing it" situation the commit claimed to fix. | The split waterline could not appear in ordinary play. |

All three are fixed in the first commit of this branch. Everything else described by that commit
(hold-to-swim, charge, Follow / Remote / Surface styles, preferences, gamepad path, legacy profile) was
present and was kept, then reworked where it was weak (below).

## 2. Already present vs changed

| Area | Already present at `93b84d5` | This pass |
|---|---|---|
| Keyboard scheme | Space hold = swim (+ 1.8 Hz cadence kicks), Shift charge, WASD, X **or Ctrl** brake, Q/E depth trim, Z/C extra roll, R, V | Kept Space / Shift / WASD / X / R / V. **Removed Ctrl** (Ctrl+W closes the tab), Q/E and Z/C from the Modern scheme (dive / climb and auto-bank make them redundant; they survive in Legacy). Added a short analog ramp on W/S and A/D (a tap is a nudge, a hold is full authority in ~0.2 s). |
| Gamepad | LS steer, A or RT swim, B charge, X or LT brake, bumpers = extra roll, Y or **any D-pad** = camera, Start menu. **Stick forward = nose UP** (opposite to W). | LS steer with **forward = nose down** (like W, like Ecco; Invert flips both), RT (analog) or A swim, **LB or B charge**, **LT or X brake**, RS look, Y or D-pad ◄► camera style, **RS-click recenter**, Start menu, **Back = controls sheet**. No phantom edge from a pad that arrives with a button held. |
| Arbitration | Keyboard wins for 1.5 s after *any* watched key, **including R / V and mouse look** → pressing V while playing on a pad froze the pad for 1.5 s; no body signal → "autopilot" glide and HUD "none". | Last-touched-wins between keyboard and pad; only control inputs count; body input only once a signal has arrived (or Input = Body). No webcam → keyboard is simply the idle source. |
| Safety | Keys never cleared on window blur (alt-tab with Space held = a dolphin that swims forever); Ctrl/Meta/Alt chords swallowed; mouse look from any left-button drag, including drags that started on the settings panel. | Blur clears everything; browser chords are left alone; a look-drag must start on the canvas (left or right button). |
| Propulsion | Hold = constant 3.6 m/s² + cadence impulses, hard clamp at the cap: **every hold level pinned to 5.00 m/s** (an analog trigger did nothing), **charge release dropped 9 → 5 m/s in one 8 ms step**, brake τ 0.15 s (cruise to a dead stop in 0.33 s). | Speed-seeking hold thrust (analog target 40–100 % of cruise, equilibrium exactly on target), overspeed **bleeds** (τ 0.7 s) instead of stepping, bounded tap-lunge, brake τ 0.35 s. Deterministic; replay digests of scripts that hold / charge differ from before (documented). |
| Camera | Skim constants present but inert (bug above); orbit offset from mouse / stick persisted until R. | Skim fixed and retuned (Follow eye ≈ −0.10 m, Surface ≈ +0.10 m at the ceiling); orbit returns behind the dolphin by itself while swimming (holds while hovering); yaw wraps; chase FOV is a preference. |
| Interface | Play tab "Ecco-Inspired / Legacy", info rows hard-coded, F1 sheet listed Ctrl, Q/E, Z/C; HUD said "Hold A to swim". | One source of truth for binding text (`controlPrefs.ts BINDINGS`) used by the Play tab, HUD prompt and toasts; F1 sheet, start overlay, loader tips and README rewritten; new "Chase field of view" slider; "Modern" / "Legacy BodyArcade". |
| Tests | 35 unit checks (3 failing); live suites paced on wall-clock `sleep`. | 52 unit checks + a 99-check controls scenario suite (fake window, real sim and rig), all green; live suites re-paced on the world clock so they run identically at 70 fps and on a 1 fps software adapter; new `controls-live.mjs` (real key / mouse / simulated-gamepad events); `review.mjs --headless`. |

## 3. Final bindings

**Modern (default)** — keyboard: **Space** hold swim / tap stroke · **Shift** charge · **W** dive / **S**
climb · **A / D** turn · **X** brake · **V** camera style · **R** recenter · **1 / 2 / 3** assist · drag
the view to look. Gamepad (standard mapping): left stick steer (forward = nose down) · **RT** (analog)
or **A** swim · **LB** or **B** charge · **LT** or **X** brake · right stick look · **Y** / D-pad ◄►
camera style · right-stick click recenter · **Start** menu · **Back** controls sheet.

**Legacy BodyArcade** — keyboard: **Shift** kick (tap = one, hold = 1.6 Hz) · **Space** burst · W / S
pitch · A / D bank · **Q / E** depth · X brake. Gamepad: A kick · B burst · X brake · bumpers trim.

**PosePuppet** (both schemes): kick rhythm, lean to pitch / bank, crouch / stretch for depth, hands
forward to burst — unchanged.

## 4. Control-design rationale

The brief delegated the design and asked for Ecco: Defender of the Future as the major inspiration
with modern third-person conventions. The decisions, and what was weighed against them:

- **Hold to swim, tap to stroke (Space / RT).** Ecco's "hold A to swim, tap for bursts" is the core
  feel and it was already the right call; what was missing was the physics behind it (§5). The tap
  lunge survives as a bounded overshoot so a rhythm of taps still feels like tail strokes. Rejected:
  tap-only propulsion (the Legacy cadence), which asks for constant input and reads as a rowing
  minigame rather than a swimming animal.
- **Analog trigger = speed.** RT is the primary pad swim because a trigger carries a level: a gentle
  squeeze cruises at 2–3 m/s through the reef, full pull is cruise. A is kept for players who prefer a
  face button. Previously every level pinned to 5 m/s, so the trigger was a switch.
- **Charge on a bumper or B; brake on a trigger or X.** LB + RT is comfortable to hold across both
  hands (index fingers); B/X mirror them for thumb players. Charge works without the swim held (it
  accelerates on its own), so B does not fight A. Rejected: charge on RB (same finger as RT).
- **W dives.** Pushing forward noses down — the flight convention and Ecco's and Abzû's default; the
  stick now agrees with the keyboard (it was inverted). Invert vertical flips both.
- **Character-relative steering, camera that returns.** With a chase camera, left means "turn left"
  (Ecco), not "move toward screen-left". A free look that *stayed* offset turned that into
  camera-relative confusion, so the orbit now eases back behind the dolphin once the player stops
  looking and swims on (0.7 s hold, τ 1.4 s; τ 0.6 s while steering). A hovering dolphin keeps the look,
  so the reef can still be studied. R / RS-click snaps it.
- **No depth trim, no extra roll, no Ctrl.** Q/E vertical translation without pitch reads as a
  helicopter and is unnecessary once dive / climb are immediate; manual extra roll fought the
  auto-bank; Ctrl is a browser modifier (Ctrl+W closes the tab mid-dive). All three remain in Legacy.
- **Keyboard analog ramp.** Digital keys reach full deflection over 0.22 s (pitch) / 0.18 s (roll):
  a tap is a small correction, a hold is a committed turn or dive, without dulling the hold.
- **Brake into a turn.** Kept the speed-shaped turn authority (≈ 80°/s at cruise, ≈ 110°/s slow) and
  taught it in the help text: braking tightens a turn — a small skill depth instead of a sharper
  default turn that would make cruising twitchy.
- **Not done, deliberately:** a dedicated 180° turn-around (Ecco DotF had one). The 2.4 s cruise
  U-turn plus brake-to-tighten covers it; a scripted turn is a new sim state and more to learn.
  Stamina / charge cooldown: free charge is more fun in an exploration game; nothing here depends on
  limiting it.

## 5. Swimming feel — what changed in the 120 Hz model

All changes are inside `sim.ts` and deterministic (fixed step, no RNG, no render-frame or GPU input).

| Behaviour | Before (`93b84d5`) | After | Why |
|---|---|---|---|
| Hold from rest | 0.5 → 4.5 m/s in 0.97 s (3.6 m/s² + 1.8 Hz impulses), then a hard clamp at 5.00 | 0.5 → 4.5 m/s in 0.92 s, curve into cruise, settles at exactly 5.00 (equilibrium thrust = drag) | A clamp arrival is a wall; the curve is a swimmer easing off. |
| Analog hold | Any level ≥ 0.12 → 5.00 m/s | Target = 5 × (0.4 + 0.6 × level): 0.3 → 2.9, 0.6 → 3.8, 1 → 5.0 m/s | Makes the trigger a throttle. |
| Charge release | **9.00 → 5.00 m/s in one 8 ms step** (the `clamp` at the cap) | Bleeds with τ 0.7 s: 6.5 m/s after 0.5 s, cruise ± 0.05 after ~2.5 s while swimming; a glide if released entirely | The single worst feel defect found. Re-entry from a breach (speed × 0.85 ≈ 7.6 m/s) benefits too. |
| Tap at cruise | Impulse clamped away (no effect) | Lunge ≤ +1.0 m/s, bleeds back | Ecco's tap rhythm; bounded so tap-spam cannot exceed cruise + 1. |
| Brake | τ 0.15 s: 5 → < 0.5 m/s in 0.33 s | τ 0.35 s: still 1.5 m/s at 0.4 s, < 0.5 m/s at 0.76 s | A 3 m animal does not stop in a third of a second; still prompt and predictable. |
| Glide, turning, pitch, auto-level, breach, containment, contact, anti-wedge, drift | unchanged | unchanged | Measured and judged fine: glide 5 → 3.0 m/s in 3 s; W tap 150 ms = 13°; breach at cruise from −2.5 m with a held nose-up (apex ≈ 0.9 m; ≈ 1.8 m with charge). |

Governed speeds are preserved as *sustained* caps (cruise 5 / burst 9). Replay digests change for any
script that holds `swim`, releases `burst`, or kicks near the cap; scripts that only kick below cruise
or only burst are unchanged. The replay contract (byte-identical runs) is re-asserted in the unit,
controls and live suites.

## 6. Camera and the split waterline

**Diagnosis.** Tidewater's own near-plane waterline (`post/Underwater.js`) splits the frame wherever
the rendered sea surface crosses the camera's 0.1 m near plane and classifies pixels per medium within
±0.35 m of the surface. Nothing in the integration rendering was wrong — the lens was simply never
near the water: with the skim inert, the Follow eye floated 0.7 m above a surfaced dolphin and the
swell passed beneath it. With the argument order fixed, `chaseHeight` blends 1.1 m (deep) to
`HEIGHT_SURFACE` as the body rises from −3.6 m to −0.55 m.

**Tuning.** At the dolphin's surface ceiling (sim y −0.4) the Follow eye now sits ≈ 0.10 m *under*
the mean sea level, positioned against the sim body (not the swell-ridden presentation), so the
waves (±0.2–0.3 m in the default Breezy sea) cross the stationary lens both ways: mostly the
underwater view of the dolphin with the surface just overhead, the lens popping into air at every
trough, and Tidewater's split frame and meniscus at each crossing. The **Surface** style puts the eye
≈ 0.10 m *above* the mean — the pristine swimmer's eye (`Player.js`: "eyes ~10 cm above the water;
waves still wash over") — mostly sky and island with waves washing over. **Remote** keeps the Follow
height with a looser yaw follow (τ 0.85 s) and 18 % more distance. Nothing pins the camera to a wave
and nothing oscillates: the eye is a smooth function of body depth; the sea moves, the lens does not.

Headless evidence: unit checks (eye −0.10 m at the ceiling, ±0.3 m waves give ≥ 2 crossings per
4 s with the eye still; deep cruise keeps 1.1 m; hover never re-triggers SurfaceTransition). Live
evidence with Tidewater's medium target: see §9.

## 7. Input-source arbitration (as shipped)

`keyboard` and `gamepad`: the one touched last owns the dolphin while held and for a hold-over
(keyboard 1.5 s, pad 0.6 s); a key press during a pad hold takes over, releasing it hands straight
back; stick movement during a held key does not wrestle control away. Only control inputs count —
R, V, the assist keys, mouse look and menu keys never move ownership. `body` drives only when
neither is live and a signal has arrived (or Input = Body); stale or low-confidence tracking glides
on autopilot as before; a live pad or key always beats it. Input = Keyboard / Gamepad pin the source.
Disconnecting a pad mid-hold drops swim and charge the same frame and falls back to the keyboard;
reconnecting with a button held fires no phantom stroke. `setEnabled(false)` (Walking / Boat) clears
everything; returning to the dolphin requires a fresh press.

## 8. Interface and documentation

Play tab → Dolphin Controls: Scheme (Modern / Legacy BodyArcade), Input, Camera style (Follow / Remote /
Surface), Invert vertical, Steering sensitivity, Look sensitivity, Camera distance, **Chase field of
view** (new, 40–75°, persisted; walker / boat / free camera keep 62°), Keyboard and Gamepad rows that
follow the scheme and report whether a pad is connected. The Player "Controls" row, the mode toasts
and the HUD gamepad prompt read from the same `BINDINGS` table. F1 sheet, start overlay keys, loader
tips and README rewritten to the shipped bindings; no setting exposes raw physics.

## 9. Verification

### Headless, no GPU (this environment, Node 22)

| Check | Result |
|---|---|
| `npm run typecheck` (`tsc --noEmit`) | clean (2 errors at the starting commit) |
| `npm run build` (tsc + `vite build`) | clean, 1.89 MB main chunk |
| `test/unit.ts` — additive layers, sampler, obstacle correction, sim determinism, containment, chase rig (no waterline exclusion, skim heights, still-lens crossings, airborne framing), **new**: hold thrust, analog levels, charge release, brake, tap lunge, breach at cruise, orbit relax / hold / wrap | **52 / 52** |
| `test/controls.ts` — production input listeners driven by synthetic keyboard / mouse / gamepad / body-signal events through the real sim and rig, 60 Hz polls, 20 scenario groups | **99 / 99** |

### Live, in the real app (headless Chromium on Chrome's SwiftShader WebGPU adapter)

**Blocked in this environment — not by the suites, by the adapter.** The container has no GPU; headless
Chromium 153 exposes WebGPU only through Chrome's SwiftShader adapter (`vendor google / architecture
swiftshader`). The app was driven to the end of its shader compilation there (≈ 4 min) and failed every
time at the same point: the adapter's `maxStorageTexturesPerShaderStage` is **4**, Tidewater's own
mip-generation compute kernels bind **5** (`envSource mips A.g1`, `Ocean Mips A.g1` →
"The number of storage textures (5) in the Compute stage exceeds the maximum per-stage limit (4)"),
the dependent pipelines are invalid and the device is lost ("A valid external Instance reference no
longer exists") before the first frame. That is a hard limit of the software adapter; it cannot be raised
by flags and the vendor code is off limits. Reproduced three times, including a reduced run (640×360,
`?scale=0.5&noClouds&noHaze&noVeg&noCaustics`) with Chrome's GPU log.

What *was* exercised live here: `review.mjs --headless` launches, serves its RPC endpoint, navigates,
evaluates, injects key presses and mouse drags and takes screenshots (the plumbing the four live suites
run on). The suites themselves (`play`, `waterline`, `modes`, `controls-live`) were rewritten and
syntax-checked but **have not been executed against a rendering app in this session**; they need a real
WebGPU adapter. They are paced on the world clock, so they run unchanged on the Mac's headed review Chrome
and on any headless Chromium with a GPU (`node review.mjs --headless`).

The committed `eval/results/*.json` are the Mac M5 baselines from the previous session and were left
untouched (no fabricated results). Re-running the suites on the Mac is the first verification step of this
branch (§14); write to `TIDEWATER_RESULTS_DIR=eval/results/mac` or overwrite the baselines, as preferred.

### Visual and interactive checks that remain unverified here

Not visually verified in this session (no rendering adapter):

- the Follow lens at the surface ceiling with Tidewater's waves crossing it in ordinary play, the split
  frames and meniscus (unit-verified geometry only: eye −0.10 m, ±0.3 m waves cross it);
- the Surface style's swimmer's-eye framing and Remote's looser follow;
- the look-orbit return feel (τ 1.4 s / 0.6 s while steering) and the mouse-drag sensitivity;
- the keyboard ramp, brake and charge-release feel at real frame rates; breach and re-entry framing;
- the Play tab controls, HUD prompts, toasts and F1 sheet as rendered;
- gamepad with a physical controller (the simulated pad exercises the same code path);
- PosePuppet body input with a live camera (transport and arbitration exercised with synthetic signals).

`test/waterline.mjs` and `test/controls-live.mjs` cover the first six with Tidewater's own medium target
and real input events; a human still has to judge whether it *feels* right.

## 10. Performance

No new product performance numbers were obtained: the only adapter here is software and the app does not
initialise on it. The previous session's Apple M5 / Chrome 155 numbers (`eval/CP10_REPORT.md` §7: dolphin mode
77–79 fps live at 1440×760, rig update < 400 µs, sim 120 Hz) remain the reference; nothing in this pass adds
per-frame work beyond a few scalar operations in the rig (orbit relax) and the input layer (gamepad poll was
already there). The headless suites run the full 120 Hz sim + rig at ~2 000× real time in Node.

## 11. Tidewater untouched

`git diff --stat HEAD -- apps/tidewater-dolphin/vendor` is empty, and the 430-file SHA-256 manifest in
`vendor/tidewater/BODYARCADE_SOURCE_RECORD.md` re-verifies against the working tree
(`sha256sum -c`). Water shaders, wave simulation, refraction, caustics, scattering, waterline
compositing, lighting, post-processing and environment parameters are the pinned `4811ba4` bytes.
`apps/shared-world/` is untouched.

## 12. Remaining human playtesting

On the Mac (headed review Chrome, real WebGPU), in this order:

1. `npm run test` and `npm run build` (should be green), then the four live suites (§14).
2. Fresh session: hold **Space** from the spawn — does the acceleration into cruise feel like a dolphin easing
   off rather than hitting a cap? Release — is the glide long enough to feel graceful but short enough to control?
3. **Shift** from cruise, then release while still holding Space: the ease back to cruise should read as the animal
   relaxing, never a stop. Compare with the old 9 → 5 step if you remember it.
4. Surface swimming: at the −0.4 m ceiling, does the Follow lens give the intended experience — mostly under,
   popping into air at troughs, the split frame at every crossing? Is the crossing cadence comfortable, or does it
   feel like flicker in the Breezy sea? (If the latter, `RIG.HEIGHT_SURFACE` 0.30 → 0.26 puts the eye 4 cm deeper
   and halves the time in air; 0.34 does the opposite.) Try **V** → Surface for the swimmer's-eye alternative.
5. Drag the view, release, keep swimming: does the camera's return behind you feel natural (1.4 s) or sluggish /
   abrupt? Hover (X) and drag: the look should stay.
6. Reef at cruise and at a light trigger pull (RT 30 %): is the speed-shaped turn authority enough, and does
   "brake into the turn" read as a technique?
7. A physical gamepad: RT analog feel, LB/LT reach, Y / RS-click, Start / Back; unplug mid-swim.
8. PosePuppet with a camera: keyboard and pad still win while touched; loss glides.
9. Walking / Boat and back with keys held: nothing stuck.

## 13. Files changed and commits

All under `apps/tidewater-dolphin/`; one commit on `bodyarcade-tidewater-cp10-controls-camera` whose parent is the starting commit `93b84d5` (the hash is in the delivery message and in `git log`; a file cannot cite its own commit). Nothing under `vendor/`, nothing in `apps/shared-world/`.

| File | Change |
|---|---|
| `src/input/swimControls.ts` | rewritten: arbitration, Modern / Legacy bindings, keyboard ramps, pad mapping (forward = dive, LB/B charge, LT/X brake, RS click, Back), canvas-only drag look with pointer-delta fallback, blur / chord / typing safety, HUD state |
| `src/input/controlPrefs.ts` | ranges, labels and the `BINDINGS` text the interface shows |
| `src/dolphin/sim.ts` | hold thrust toward a target, overspeed bleed, tap-lunge bound, brake τ (see §5) |
| `src/dolphin/cameraRig.ts` | smoothstep order fix, skim heights, orbit relax / wrap / hold, prefs lens, eval fields |
| `src/dolphin/dolphinPlayer.ts` | constructor order (boot fix), help hook, steer magnitude to the rig, `time` / `source` / `swimLevel` in the eval state, lens only while controlled |
| `src/DolphinApp.js` | chase lens from the preference on every return to the dolphin |
| `src/DolphinAppUI.js`, `src/credits.ts`, `index.html`, `README.md` | Play tab (Modern / Legacy, FOV slider, binding rows, prompts, toasts), F1 sheet, start overlay, loader tips, README |
| `test/unit.ts` | expectations for the skim and crossings; new sim and orbit checks (52) |
| `test/controls.ts` | **new** — 99-check input-layer scenario suite |
| `test/play.mjs`, `test/waterline.mjs`, `test/modes.mjs` | game-time pacing, env-configurable URLs / results dir, environment record, trials updated to the new propulsion and camera |
| `test/controls-live.mjs` | **new** — real key / mouse / simulated-gamepad trials in the running app |
| `review.mjs`, `eval/lib/rpc.mjs` | `--headless` launcher mode, mouse RPC ops, world-clock helpers |
| `package.json` | `test` runs both headless suites; `test:unit`, `test:controls` |
| `eval/CP10_CONTROLS_CAMERA_PASS.md` | this report |

## 14. Running it

```sh
npm --prefix apps/tidewater-dolphin install
npm --prefix apps/tidewater-dolphin run test          # unit + controls (no GPU)
npm --prefix apps/tidewater-dolphin run build
npm --prefix apps/tidewater-dolphin run dev           # http://127.0.0.1:5199/  (dolphin: hold Space, WASD, Shift, X; V / R; drag to look)
npm --prefix apps/tidewater-dolphin/vendor/tidewater install && npm --prefix apps/tidewater-dolphin run pristine   # :5189, for the waterline side-by-side

# live suites against the dedicated review Chrome (real WebGPU) — in a second terminal
node apps/tidewater-dolphin/review.mjs                # headed; or: node apps/tidewater-dolphin/review.mjs --headless
node apps/tidewater-dolphin/test/controls-live.mjs
node apps/tidewater-dolphin/test/play.mjs
node apps/tidewater-dolphin/test/waterline.mjs
node apps/tidewater-dolphin/test/modes.mjs
# optional: TIDEWATER_RESULTS_DIR=eval/results/<machine> to keep the committed baselines
```
