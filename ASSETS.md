# Assets

## In use (no approval needed)

| asset | origin | license | in git? |
|---|---|---|---|
| Procedural robot | built from three.js primitives in `src/rig/robot.ts` | ours | yes (code only) |
| MediaPipe `pose_landmarker_full.task` | Google, fetched postinstall | Apache-2.0 | no (downloaded to `public/models/`) |
| MediaPipe tasks-vision WASM | Google, copied from node_modules postinstall | Apache-2.0 | no (copied to `public/mediapipe-wasm/`) |
| Inter (variable) | `@fontsource-variable/inter` npm package, bundled at build | SIL OFL 1.1 | no (node_modules → dist assets) |
| JetBrains Mono (variable) | `@fontsource-variable/jetbrains-mono`, bundled at build | SIL OFL 1.1 | no (node_modules → dist assets) |
| Fraunces (variable) | `@fontsource-variable/fraunces`, bundled at build | SIL OFL 1.1 | no (node_modules → dist assets) |
| MediaPipe `hand_landmarker.task` | Google, fetched postinstall | Apache-2.0 | no (downloaded to `public/models/`) |
| MediaPipe `selfie_segmenter.tflite` + `selfie_segmenter_landscape.tflite` | Google, fetched postinstall (V7 presentation layer) | Apache-2.0 | no (downloaded to `public/models/`) |
| Hand puppets (hand / beaky / x-ray) | procedural, built from three.js primitives in `src/hand/` | ours | yes (code only) |

Fonts are self-hosted and served same-origin so the privacy receipt's
"0 external requests" stays literally true — no Google Fonts at runtime.

Fixture videos are personal camera footage and are never committed (gitignored
from commit 1).

## VRM avatar shortlist

**APPROVED 2026-06-10 by Lekan (in-session structured reply): candidate 1,
100Avatars (CC0).** The specific avatar file will be chosen from the registry
at M4 prep; before it is committed, this section gets the exact avatar name,
download URL, and license text recorded alongside it. `public/avatars/*.vrm`
stays gitignored until that record exists. Candidates 2–3 below are kept as
fallbacks.

### CHOSEN: "Astronaut" (048, 100Avatars R1) — in use since 2026-06-10
- **File:** `public/avatars/astronaut.vrm` (gitignored binary; 1.7 MB, VRM 0.x)
- **Download URL:** https://arweave.net/T0c0z_XEPQHy3vyXz31XB22s_6JTqHdnau8exq_I8tI
  (registry entry: `data/avatars/100avatars-r1.json`, name "Astronaut", number 048,
  in [ToxSam/open-source-avatars](https://github.com/ToxSam/open-source-avatars))
- **License evidence:** registry `projects.json` lists 100Avatars R1 as
  `"license": "CC0"`; **the file's own embedded VRM meta says
  `licenseName: "CC0"`, title "Astronaut"** (inspected from the glb JSON
  chunk after download — strongest possible evidence, carried in the asset
  itself). Creator: Polygonal Mind.
- To fetch on a fresh checkout: `curl -L -o public/avatars/astronaut.vrm <URL above>`

### CHOSEN: "Erika" (053, 100Avatars R1) — in use since 2026-06-12 (pass-2 Gate 4)
- **File:** `public/avatars/erika.vrm` (committed; 1.5 MB, VRM 0.x)
- **Download URL:** the `model_file_url` for name "Erika", number 053, in
  `data/avatars/100avatars-r1.json` of
  [ToxSam/open-source-avatars](https://github.com/ToxSam/open-source-avatars)
  (arweave-hosted, same registry as the astronaut)
- **License evidence:** registry lists 100Avatars R1 as `"license": "CC0"`;
  **the file's own embedded VRM meta reads `licenseName: "CC0"`, title
  "Erika"** (read from the glb JSON chunk at download). Creator:
  Polygonal Mind.
- **Why added:** the Gate-3 live test showed neither default avatar has
  movable finger geometry; Erika has a real 40-bone articulated hand rig —
  fist/open/point verified closing correctly in-app before approval.

### 1. 100Avatars series (Polygonal Mind) — APPROVED
- **Source:** [open-source-avatars registry](https://github.com/ToxSam/open-source-avatars) / [opensourceavatars.com](https://www.opensourceavatars.com/en/gallery)
- **License:** CC0 1.0 — registry states "Our own free avatars, no attribution needed"; 300+ VRM avatars
- **Why:** cleanest possible license, big stylized variety — easy to pick one
  whose look sits well next to the robot on the dark stage. Specific avatar
  chosen together at approval time.

### 2. VRoid Project official sample models (AvatarSample D/E/F/G, Sendagaya Shino, Sakurada Fumiriya)
- **Source:** official VRoid Project release (alpha-era sample models); mirrored with license statement on [OpenGameArt](https://opengameart.org/content/vroid-studio-cc0-models)
- **License:** CC0 — OpenGameArt listing states they "were explicitly released by VRoid under CC0", citing the official VRoid help article ([4402614652569](https://vroid.pixiv.help/hc/en-us/articles/4402614652569))
- **Caveat:** the primary VRoid help page blocks automated fetching (HTTP 403),
  so the CC0 statement above is verified only via the OpenGameArt mirror —
  **click the primary link in a browser during approval before we commit.**
- **Why:** polished classic VTuber look, certain provenance (official VRoid
  Project — not "anime of unclear origin").

### 3. Seed-san (VirtualCast, Inc.) — official VRM1 reference model
- **Source:** [vrm-c/vrm-specification samples](https://github.com/vrm-c/vrm-specification/tree/master/samples/Seed-san)
- **License:** [VRM Public License 1.0](https://vrm.dev/en/licenses/1.0/index) — redistribution and avatar use are permitted *per the license settings embedded in the file's VRM meta*; must inspect the embedded meta at download and record the settings here before committing
- **Why:** the canonical VRM1 conformance model — guaranteed clean humanoid
  bone map; weakest of the three on license simplicity.

**Decision needed from Lekan:** pick one (or rank two) at the M2 gate reply.
The chosen file will live in `public/avatars/` (gitignored until this section
records the approval + exact license text alongside the download URL).

---

### Licensed Woody avatar — user supplied

- **FBX source:** `/Users/lekan/Downloads/woody/woody-toy-story-rig-free-download/source/T-Pose (9).fbx`
- **Texture directory:** `/Users/lekan/Downloads/woody/woody-toy-story-rig-free-download/textures`
- **Reference GLB:** `/Users/lekan/Downloads/woody/woody_toy_story_rig_free_download.glb`
- **Runtime VRM path:** `public/avatars/woody.vrm`
- **Rig type:** Mixamo (`mixamorig:Hips`, `mixamorig:LeftArm`, etc. — 64 bones)
- **Status: LOCAL-ONLY, NOT REDISTRIBUTABLE (Gate 1 decision, 2026-06-12).**
  This is a fan-made rig of a licensed Disney/Pixar character; it cannot ship
  in a public repo or deploy. It was committed and deployed for a period
  after pass 1 — that commit was reverted at pass-2 Gate 1: the file is
  untracked + gitignored again (note: it still exists in git history), the
  registry marks it `optional` and removes it from the avatar cycle when the
  file is absent, and the default avatar is the CC0 astronaut. Woody never
  appears in screenshots, demo clips, or POSTS.md claims for pass 2. The app
  only expects the final VRM file to exist locally at the runtime path above.

#### Local usage

```sh
cd /Users/lekan/Dev/posepuppet

mkdir -p public/avatars

/Applications/Blender.app/Contents/MacOS/Blender \
  -b \
  --python tools/export_fbx_to_vrm.py \
  -- "/Users/lekan/Downloads/woody/woody-toy-story-rig-free-download/source/T-Pose (9).fbx" \
  public/avatars/woody.vrm

npm run dev
```

Then open: `http://localhost:5173?avatar=woody`

#### Likely failure modes

| symptom | cause |
|---|---|
| `blender: command not found` | Blender not at `/Applications/Blender.app/Contents/MacOS/Blender` |
| `VRM Add-on is not installed` | Script uses GLB+VRM-injection path; this should not happen |
| `No armature found` | FBX has no skeleton data |
| `Incomplete humanoid bone mapping` | Auto-map failed; pass `--mapping tools/woody-bone-map.json` |
| Pink/missing materials | Texture path mismatch in FBX; repair in Blender GUI, re-export |
| Model facing wrong direction | May need 180° rotation in Blender or a root transform |
| Model too large/small | Scale factor; adjust in Blender export settings |
| Long limbs/proportions | Calibrate in-app or apply per-bone offsets in the settings panel |


---

## BodyArcade Flight (`apps/flight/`) — TinySkies / GlobeFly fork manifest

TinySkies / GlobeFly by Danny Limanseta is used with permission —
https://github.com/dannylimanseta/tinyskies. The permission record is
retained privately (gitignored); public attribution is the line above,
in-app credits, and the README section.

Manifest status per acceptance item 1. Classification: **copied** =
byte-identical to upstream; **adapted** = upstream file modified (each
gains a note here as it changes); **original** = written for BodyArcade.

| files | class | notes |
|---|---|---|
| `apps/flight/client/src/**` except below | copied | upstream game code, three.js 0.172 |
| `apps/flight/client/src/main.ts` | adapted | removed `@vercel/analytics` init (no telemetry) |
| `apps/flight/client/package.json` | adapted | removed `@vercel/analytics` dependency |
| `apps/flight/shared/**`, `apps/flight/server/**` | copied | server kept optional (docker-compose) |
| `apps/flight/docker-compose.yml`, `README.md`, `docs/**`, `package.json`, `package-lock.json` | copied | upstream root files |
| `apps/flight/client/public/fonts/*` | copied | Domine, Darumadrop One — Google Fonts, SIL OFL 1.1 |
| `apps/flight/client/public/audio/**` (~66 SFX + music) | copied — AI-generated for upstream | upstream's own lobby attribution: "Music by Suno, SFX by ElevenLabs" — generated works commissioned by the author, within his grant. Lekan confirms commercial-output tiers with Danny before the repo goes public |
| `apps/flight/client/public/3D/*.glb` (10 models) | copied — AI-generated for upstream | upstream attribution: "3D Assets by Tripo3D" — same footing as audio |
| `apps/flight/client/public/2D/**`, `npc/**`, `social-card.png` | copied | game art, presumed author-made; same verification sweep |
| excluded from fork | — | `.git`, `node_modules`, `dist`, `vercel.json`, `railway.toml`, `.github/`, `api/`, `patch*.js`, `.env` (deploy/codemod glue) |

Original BodyArcade files under `apps/flight` (all ours):

| file | class | notes |
|---|---|---|
| `client/src/runtime/localWorlds.ts` | original | LocalWorldProvider (name pools copied from upstream server/src/utils/worldNames.ts) |
| `client/src/input/bodyControls.ts` | original | body-signal feed + profile mapping + keyboard-priority merge |
| `client/src/input/flightTuner.ts` | original | control tuner overlay |
| `playwright.config.ts`, `tests/**` | original | flight suite (offline parity, body closed-loop, perf) |

Upstream files adapted beyond the P0 manifest: `client/src/game/Game.ts`
(local-mode guards, body-input merge, tuner/eval hooks),
`client/src/game/Plane.ts` (optional analog speed/elevate consumption),
`client/src/game/FlightControls.ts` (ControlState optional analog fields),
`client/src/ui/Lobby.ts` (skip save-feed fetch offline),
`client/index.html` + `client/src/main.ts` (self-hosted Inter, external
widget removed), `client/vite.config.ts` + `client/tsconfig.json`
(body-input alias).

## BodyArcade Dolphin — world data (packages/world-data)

| files | class | notes |
|---|---|---|
| `packages/world-data/data/raw/san-francisco-bay-coastline.osm.json.gz` | data — OpenStreetMap | Overpass extract of `natural=coastline` ways, bbox 37.42..37.97 / −122.56..−122.03, fetched 2026-07-11; © OpenStreetMap contributors, ODbL 1.0; committed so builds reproduce offline |
| `packages/world-data/data/boundaries/san-francisco-bay.json` | data — derived from OSM | simplified + projected boundary artifact; full provenance, license, and attribution embedded in the file; `loadBoundary()` refuses artifacts without attribution; the in-app ODbL credit ships with the dolphin shell (P2) |
| `packages/world-data/src/**`, `tools/**`, `configs/**` | original | boundary pipeline (fetch/build/render/check) + runtime containment/distance surface |

## BodyArcade Dolphin (apps/dolphin)

| files | class | notes |
|---|---|---|
| `apps/dolphin/**` | original | all geometry, shaders, world dressing and UI are procedural/code — no third-party or imported assets of any kind; the only external data is the boundary (see the world-data section above) |
