# CHECKPOINT 00 — Scaffold and Stock Demo

## Header

**Checkpoint:** 00 — Scaffold and Stock Demo
**Prerequisite:** None (first checkpoint).
**Base branch:** `origin/bodyarcade-v4-base @ 493dd24`. Create a working branch: `git switch -c bodyarcade-shared-world origin/bodyarcade-v4-base`.

---

## Scope

**Build:**
1. Create the `apps/shared-world/` directory structure per the integration contract.
2. Set up `package.json` (`@bodyarcade/shared-world`, private, type module, `three@^0.184`, `@types/three@^0.184`).
3. Create `vite.config.ts` (clone from `apps/dolphin/vite.config.ts`; `base: '/shared-world/'`; aliases to monorepo packages; dev port **5198**; `poseAssets()` middleware).
4. Add `sharedWorldStatic()` to root `vite.config.ts` (clone `dolphinStatic()` with `SHARED_WORLD_DIST = ./apps/shared-world/dist` and prefix `/shared-world/`; extend MIME map with `.glb: 'model/gltf-binary'`).
5. Add root scripts: `"shared-world:dev"`, `"shared-world:build"`; extend `"arcade"`.
6. Vendor `jeantimex/threejs-water` pristine inside `apps/shared-world/`. Clone the repository; **pin the exact commit SHA** in a `JEANTIMEX_SHA.txt` file alongside the vendored source. Do NOT modify any jeantimex source file.
7. Wire the jeantimex demo as the app's entry point — the stock demo runs at `http://localhost:5198/shared-world/`.
8. Copy the dolphin GLB from `/Users/lekan/Downloads/dolphin-models/dolphin-fbx.glb` to `apps/shared-world/public/models/dolphin/dolphin-fbx.glb`. Create `apps/shared-world/public/models/dolphin/LICENSE-dolphin.txt` with the CC-BY 4.0 attribution text from the implementation master §8.4. Create a root `CREDITS.md` entry.
9. Run `npm install` from the monorepo root.

**Out of scope:**
- Any modification to jeantimex source files.
- Dolphin model loading or animation (checkpoint 01).
- Camera work (checkpoint 02).
- Any terrain, region, or world data.
- Any modification to `apps/dolphin/` or any other existing app.

---

## Inputs

| Input | Section | Purpose |
|---|---|---|
| `BODYARCADE_SHARED_WORLD_IMPLEMENTATION_MASTER.md` | §3 (Codebase Plan) | Integration contract, file paths, port details |
| `TRACK_A_REPOSITORY_AUDIT_REPORT.md` | §11 | Detailed scaffold contract (Vite config, same-origin, ports) |
| `TRACK_C_ASSETS_AUDIO_DOLPHIN_REPORT.md` | §10 | Dolphin file paths, license text, attribution |
| `/Users/lekan/Downloads/dolphin-models/dolphin-fbx.glb` | — | The dolphin asset to copy |
| `jeantimex/threejs-water` GitHub repo | — | The water demo to vendor |

---

## Specification

### Directory structure

```
apps/shared-world/
├── package.json
├── vite.config.ts
├── index.html           ← jeantimex demo entry
├── tsconfig.json
├── src/
│   └── main.ts          ← jeantimex demo bootstrap (unmodified)
├── vendor/
│   └── threejs-water/   ← pristine jeantimex clone
│       └── JEANTIMEX_SHA.txt  ← pinned commit SHA
├── public/
│   └── models/
│       └── dolphin/
│           ├── dolphin-fbx.glb
│           └── LICENSE-dolphin.txt
└── playwright.config.ts ← stub (tests added later)
```

### Vite config parameters

- `base: '/shared-world/'`
- `server.port: 5198`
- `server.strictPort: true`
- `server.fs.allow: ['..', '../..']`
- `build.outDir: 'dist'`
- `build.target: 'es2022'`
- Aliases: `@bodyarcade/body-input` → `../../packages/body-input/src/index.ts` (and similarly for `pose-runtime`, `pose-hud`)
- `poseAssets()` middleware for `/models` + `/mediapipe-wasm`

### jeantimex vendoring

The stock demo must run identically to its standalone version. Do not modify any file under `vendor/threejs-water/`. The app's `main.ts` imports and bootstraps the demo.

---

## Demo

**Standalone:**
```bash
npm --prefix apps/shared-world run dev
# Open http://localhost:5198/shared-world/
```

**What the user should see:** The exact jeantimex/threejs-water stock demo — a rectangular pool with water simulation, caustics on the floor, the interactive sphere, GUI controls. Everything interactive. Nothing changed.

**Full topology (optional):**
```bash
npm run arcade
# Open http://localhost:5173/shared-world/
```

---

## Verification

### Automated
- `npm --prefix apps/shared-world run dev` starts without errors.
- The demo renders in headed Chrome at ≥60 fps.
- No jeantimex source file has been modified (diff the vendored directory against the clone).

### Manual review
- The stock demo looks and behaves identically to `jeantimex/threejs-water` running standalone.
- The interactive sphere displaces water, caustics project on the floor, GUI controls work.
- The dolphin GLB is present at `public/models/dolphin/dolphin-fbx.glb` (not loaded yet — just present).
- `LICENSE-dolphin.txt` contains the correct CC-BY 4.0 attribution.
- `CREDITS.md` exists at the repo root with the GAMICO dolphin credit.

---

## Stop

**STOP.** Report:
1. Summary of files created.
2. The pinned jeantimex commit SHA.
3. Performance: fps at 1728×1080.
4. Any deviations from this specification.

**Wait for user review and approval before any further work. Approval of checkpoint 00 does not authorize starting checkpoint 01.**

---

## Guardrails

- No invented assets. The dolphin GLB is copied, not generated.
- jeantimex is vendored pristine — zero modifications to any source file.
- Approved visuals (the stock demo look) are immutable.
- Local-only: all commands run on macOS.
- No modifications to `apps/dolphin/` or any existing app.
