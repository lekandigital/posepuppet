# Assets

## In use (no approval needed)

| asset | origin | license | in git? |
|---|---|---|---|
| Procedural robot | built from three.js primitives in `src/rig/robot.ts` | ours | yes (code only) |
| MediaPipe `pose_landmarker_full.task` | Google, fetched postinstall | Apache-2.0 | no (downloaded to `public/models/`) |
| MediaPipe tasks-vision WASM | Google, copied from node_modules postinstall | Apache-2.0 | no (copied to `public/mediapipe-wasm/`) |

Fixture videos are personal camera footage and are never committed (gitignored
from commit 1).

## VRM avatar shortlist — PROPOSED, awaiting approval

**Mission non-negotiable: no third-party asset is downloaded into the repo or
committed until Lekan approves one of these in writing.** All three are
redistributable in a public repo + public demo per the licenses below.

### 1. 100Avatars series (Polygonal Mind) — RECOMMENDED
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
