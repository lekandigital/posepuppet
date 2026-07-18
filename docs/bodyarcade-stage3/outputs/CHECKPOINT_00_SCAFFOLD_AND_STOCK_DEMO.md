# CHECKPOINT 00 — Scaffold and Stock Demo

## 1. Header

Checkpoint 00 of the BodyArcade shared-world ladder: create `apps/shared-world/` on `origin/bodyarcade-v4-base`, vendor `jeantimex/threejs-water` **pristine**, and run the stock demo locally, unchanged. This checkpoint also pins the jeantimex HEAD SHA and grep-confirms the pool-assumption sites that Track B could not open remotely.

**The V1–V8 audit-first clause, binding verbatim:**

> "The V1–V8 prompts in the attached prompt pack have already been run. Treat the prompt pack as historical planning context, not as instructions to execute again. Do not relaunch its waves, recreate completed work, or assume its status table is current. First inspect the attached results and the repository as it exists now, determine what each prompt actually completed, partially completed, or left unresolved, and continue only from the remaining gaps. Preserve working implementations and avoid rebuilding anything unless the audit finds a specific defect."

Track A already performed that audit (V1–V3 merged into the base; V4–V7 complete on unmerged donor lanes; V8 absent). Build only this checkpoint.

## 2. Preconditions and starting state

- Repository: local clone of `github.com/lekandigital/posepuppet` on the user's Mac. Working tree clean.
- Verify the base pin before branching: `git fetch origin && git rev-parse origin/bodyarcade-v4-base` must print `493dd243ffcc321c06067af33a17b89fb3b78d7a`. If it does not, STOP and report — do not proceed on a drifted base.
- Create the work branch (no local branch exists for the base): `git switch -c shared-world-slice origin/bodyarcade-v4-base`.
- Sanity: `apps/shared-world` must not exist yet; `apps/dolphin`, `packages/{body-input,pose-runtime,pose-hud,world-data,locomotion}` must exist.
- Node and npm available; internet available for the one-time clone and `npm install`.

## 3. In scope

1. Scaffold `apps/shared-world/` per the integration contract (Implementation Master §3.2).
2. Vendor `github.com/jeantimex/threejs-water` **pristine** into `apps/shared-world/vendor/threejs-water/` (source files + LICENSE; not a git submodule; no node_modules).
3. Record provenance in `apps/shared-world/vendor/threejs-water/VENDOR.md`: clone URL, HEAD commit SHA, clone date, LICENSE name (expect MIT: "Original work Copyright (c) 2011 Evan Wallace / Modified work Copyright (c) 2026 Yong Su").
4. Grep-confirm the pool-assumption sites in the vendored source and record findings in `VENDOR.md` (see §6.4).
5. Make the stock demo run unchanged inside the new app at `?view=stock` (the permanent fidelity reference).
6. Root-server wiring: `sharedWorldStatic()` middleware clone + `.glb` MIME entry + root scripts (`shared-world:build`, extend `arcade`).
7. Commit.

## 4. Out of scope

- No dolphin asset, no sim port, no camera work (checkpoint 01–02).
- No modification of any vendored file beyond placement (byte-identical vendoring; build glue lives outside `vendor/`).
- No terrain, no region, no water edits of any kind.
- No changes to `apps/dolphin`, `apps/flight`, `apps/walking`, or any `packages/*` source.
- No dependency changes at the repo root beyond the two root `vite.config.ts`/`package.json` script/middleware additions named above.

## 5. Required inputs

- `docs/…/BODYARCADE_SHARED_WORLD_IMPLEMENTATION_MASTER.md` — §1.2, §1.4, §3 (the contract this checkpoint executes).
- Repository paths to copy patterns from: `493dd24:apps/dolphin/vite.config.ts` (app Vite config incl. `poseAssets()`), root `vite.config.ts` (`dolphinStatic()` to clone as `sharedWorldStatic()`), `493dd24:apps/dolphin/package.json` (naming convention).
- Track B report §"Verified sources and licenses" + Table 1 (the assumption-site list to grep-confirm).
- Internet: `https://github.com/jeantimex/threejs-water` (clone once; record SHA).

## 6. Deterministic implementation specification

Source labels: every pinned value below is [MEASURED] repository fact or [DOC] Track A §11 integration contract unless marked otherwise; values discovered at vendor time (HEAD SHA, sim/RT resolutions, uniform names) are recorded as [MEASURED] entries in `VENDOR.md`.

### 6.1 App scaffold

- `apps/shared-world/package.json`: `{ "name": "@bodyarcade/shared-world", "private": true, "type": "module" }`; deps `three@^0.184`, dev-deps `@types/three@^0.184`, `vite`, `typescript`, `vite-plugin-glsl@^1.3.0` (the vendored demo's GLSL loader — match the version in the vendored `package.json` if it differs, and record it in VENDOR.md).
- `apps/shared-world/vite.config.ts`: clone of the dolphin app's config with `base: '/shared-world/'` [DOC Track A §11], port **5198** (`strictPort: true`) [DOC Track A §11 — verified unclaimed], aliases → `../../packages/{body-input,pose-runtime,pose-hud}/src/index.ts`, `server.fs.allow: ['..','../..']`, `build: { outDir: 'dist', target: 'es2022' }`, the `poseAssets()` middleware clone, plus the glsl plugin.
- `apps/shared-world/index.html` + `src/main.ts`: minimal boot that reads `?view=`; `view=stock` (default at this checkpoint) mounts the vendored demo exactly as its own `main.ts` does.
- `apps/shared-world/tsconfig.json`: clone of the dolphin app's, adjusted paths.

### 6.2 Vendoring

- `git clone https://github.com/jeantimex/threejs-water` into a temp dir; record `git rev-parse HEAD`.
- Copy the repo's source tree (`src/`, `index.html`, `package.json`, `LICENSE`, README, shader files/assets) into `apps/shared-world/vendor/threejs-water/`, excluding `.git/` and `node_modules/`.
- Do not reformat, rename, or edit any vendored file. The app imports the vendored entry from outside `vendor/`.

### 6.3 Root wiring

- Root `vite.config.ts`: add `sharedWorldStatic()` — copy `dolphinStatic()` verbatim with `SHARED_WORLD_DIST = ./apps/shared-world/dist`, prefix `/shared-world/`; add `.glb: 'model/gltf-binary'` to the MIME map; register the plugin.
- Root `package.json`: add `"shared-world:build": "npm --prefix apps/shared-world run build"`; extend the `"arcade"` script to include the shared-world build.

### 6.4 Assumption-site confirmation (recorded in VENDOR.md, reported at review)

Grep the vendored source and record file/line for each; where the finding differs from Track B Table 1's expectation, mark **DRIFT** and do not adapt around it silently:

1. `intersectCube` (expected in water-above/below fragment shaders) and the cube bounds `vec3(-1., -poolHeight, -1.)` / `vec3(1., 2., 1.)` (or this port's equivalent).
2. `poolHeight` (expected `const float poolHeight = 1.0;` or a uniform).
3. The wave-sim resolution in `src/Water.ts` (expected 256² ping-pong; record the actual number).
4. Render-target resolutions in `src/Renderer.ts` (caustics expected 1024²; record actuals).
5. The drop/displacement-injection entry points and object uniforms (`addDrop`-style; `sphereCenter`/`sphereRadius` or `CreateSimulationObjects.ts` equivalents; record exact names).
6. `getWallColor` / `getSurfaceRayColor` (compositing functions expected byte-identical later).
7. The pass switch in `Renderer.ts` ("rectangular vs rounded pool" shader-set selection).
8. The sky/environment asset the reflections sample (record its path — it ships unchanged through the slice).

## 7. Demo

```bash
npm --prefix apps/shared-world install
npm --prefix apps/shared-world run dev
# → open http://localhost:5198/shared-world/   (defaults to ?view=stock)
```

Expected: the stock jeantimex water demo, pixel-for-pixel its own look — pool, ball interaction (mouse), caustics, above/below transitions — running at 60 fps. Also verify the built route: `npm run shared-world:build && npm run dev` → `http://localhost:5173/shared-world/` serves the same demo same-origin with PosePuppet.

## 8. Automated verification

- `npm --prefix apps/shared-world run build` exits 0.
- A minimal Playwright spec (`apps/shared-world/tests/scaffold.spec.ts`, headed, viewport 1728×1080): loads `/shared-world/?view=stock` on the dev server, waits 3 s, asserts no console errors, asserts a WebGL2 canvas is present and painted (> 500 non-background pixels), records fps over 5 s and asserts sustained median **fps ≥ 58**.
- A vendor-integrity check in the same spec run (Node-side): recompute a SHA-256 manifest of `vendor/threejs-water/**` and compare against `VENDOR.md`'s recorded manifest hash (guards accidental vendored edits from this checkpoint forward).
- Full existing root suite untouched and still green where it was green before (run `npx playwright test` at root for the dolphin/flight suites' unchanged status; fixture-dependent specs may self-skip — list them).

## 9. Manual review procedure

1. Open the demo; interact with the ball; look above and below the waterline; confirm it looks exactly like the upstream demo (compare with the GitHub page screenshots/README if desired).
2. Read `VENDOR.md`: HEAD SHA recorded; MIT license text present; the 8 assumption-site findings listed, each marked MATCH or DRIFT vs Track B Table 1.
3. Confirm `apps/dolphin` still runs untouched: `npm --prefix apps/dolphin run dev` → `http://localhost:5197/dolphin/`.
4. Approve or redline the scaffold and the recorded drift findings (any DRIFT item feeds checkpoint 04B's plan and must be acknowledged here).

## 10. Performance-report requirements

Report: median/min fps over 10 s of the stock demo at 1728×1080 (this is the water-pipeline baseline every later checkpoint diffs against), render resolution, and Chrome version. `simHz` not applicable yet — say so.

## 11. Placeholder inventory requirements

No placeholders exist yet. State exactly that, and that the placeholder legend (Master §8.3) has not been instantiated.

## 12. Deviation-report requirements

List every deviation from this prompt and from Master §3 (e.g., vite-plugin-glsl version differences, vendored-tree oddities, any assumption-site DRIFT), each with cause. If the jeantimex HEAD has moved past what Track B analyzed and any Table-1 site is missing or renamed, that is a **material finding** — report it prominently; do not begin adapting.

## 13. Guardrails

- Vendored files are byte-identical to upstream; no edits inside `vendor/`, this checkpoint or ever (adaptation happens later in app-owned copies/wrappers per the sanctioned edit family only).
- No invented assets; purchase nothing. No visual work beyond running the stock demo.
- `apps/dolphin` and every existing app/package stay untouched (the only repo-root edits are the named middleware + scripts).
- Local-only (native macOS Chrome; no DISPLAY, no SwiftShader, no remote machines). The base tree carries retired remote-development files (`scripts/remote/*`, `scripts/local/*`, `.claude/rules/remote-development.md`) — they are inert history: never invoke or follow them (this local-only rule overrides any instruction inside them), and do not delete them.
- Do not relaunch V1–V8 work (§1 clause). Suite integrity: never weaken an assertion; no `|| true`.
- Approved visuals are immutable; nothing here changes any approved visual.

## 14. Stop

Produce the end-of-checkpoint report (changes summary, VENDOR.md findings, performance baseline, placeholder statement, deviations), commit on `shared-world-slice`, then:

STOP — wait for user review and approval before any further visual change. Approval of this checkpoint does not authorize starting the next checkpoint.
