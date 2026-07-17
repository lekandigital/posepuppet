# Stage-3 Prompt — Implementation Prompt Writer

**Project:** BodyArcade Shared-World, Stage 3.
**Session type:** Prompt-writing/synthesis session with repository access. Runs **only after all five Stage-2 research reports are complete.**
**You are a prompt writer and specification synthesizer, not an implementer.** You write the implementation master document and the checkpoint prompt sequence. You do not write application code, modify the repository, or run builds. If you are tempted to "just implement it," stop — that is the next stage's job, in separate sessions.

---

## 1. Mission

Consume the five completed Track A–E research reports (plus their prompts and the governing decision documents) and produce:

1. **`BODYARCADE_SHARED_WORLD_IMPLEMENTATION_MASTER.md`** — one consolidated, deterministic implementation specification synthesizing all five reports.
2. **A sequence of small checkpoint implementation prompts** — each a self-contained instruction file for a fresh implementation session, where **every checkpoint ends in a runnable local demo**, and **a user approval stop precedes the next major visual change.**

"Deterministic" is the bar (from the master context): the implementing agent must be able to say *"use this exact resource, these exact files, these exact parameters, this exact placement rule, build only this checkpoint, show a demo, stop"* — selecting **nothing** on its own judgment.

## 2. Required inputs

| Input | Role |
|---|---|
| `00_BODYARCADE_MASTER_CONTEXT_V3.md` | Governing decision record (incl. Addendum A). |
| `01_NEW_DECISIONS_TO_MERGE.md` | Newest decisions; governs over the body where they conflict. Any later decision documents govern over both. |
| `TRACK_A_REPOSITORY_AUDIT_PROMPT.md` + `TRACK_A_REPOSITORY_AUDIT_REPORT.md` | What exists; preserve/replace/re-point manifest; integration contract; V1–V8 outcomes. |
| `TRACK_B_WATER_TERRAIN_CAVES_PROMPT.md` + `TRACK_B_WATER_TERRAIN_CAVES_REPORT.md` | Water minimal-edit spec; terrain baking pipeline; cave method; collision plan; performance model. |
| `TRACK_C_ASSETS_AUDIO_DOLPHIN_PROMPT.md` + `TRACK_C_ASSETS_AUDIO_DOLPHIN_REPORT.md` | Dolphin audit; asset manifest; audio mini-manifest; pipeline standards; credits obligations. |
| `TRACK_D_PS2_VISUAL_SPEC_PROMPT.md` + `TRACK_D_PS2_VISUAL_SPEC_REPORT.md` | The measurable PS2 visual spec; capture sheet. |
| `TRACK_E_ECCO_MOVEMENT_CAMERA_FEEL_PROMPT.md` + `TRACK_E_ECCO_MOVEMENT_CAMERA_FEEL_REPORT.md` | Movement/camera targets; keep/retune/replace verdicts; acceptance criteria. |
| Current repository access | `github.com/lekandigital/posepuppet` at the branches/SHAs Track A verified — spot-check that Track A's ground truth still holds; report drift. |
| Optional | The most relevant reference media (clips, VIDEO_INDEX.md) for checkpoint prompts that cite them. |

**Precondition check (do this first):** all five reports exist and each declares its own completion criteria met. If any report is missing or incomplete, stop and report which — do not synthesize around a hole.

## 3. Binding rules carried into everything you write

1. **The V1–V8 rule, carried verbatim into the implementation master:**

   > "The V1–V8 prompts in the attached prompt pack have already been run. Treat the prompt pack as historical planning context, not as instructions to execute again. Do not relaunch its waves, recreate completed work, or assume its status table is current. First inspect the attached results and the repository as it exists now, determine what each prompt actually completed, partially completed, or left unresolved, and continue only from the remaining gaps. Preserve working implementations and avoid rebuilding anything unless the audit finds a specific defect."

2. **Fidelity hierarchy:** exact jeantimex look preserved; minimal integration edits only (container swap is the canonical sanctioned edit); jeantimex wins over the Ecco spec until individually approved tweaks; jeantimex owns surface/waterline, the Track D spec owns underwater atmosphere through jeantimex's mechanisms.
3. **Strict content-generation policy:** no invented assets, ever; color-coded rectangular placeholders for everything missing; agents purchase nothing.
4. **Review gates:** every meaningful stage produces a working live demo; the user can stop, redirect, or approve; **no new major visual change without prior approval; approved visuals are never changed without permission.** The old autonomous no-gate policy stays retired.
5. **Local-only:** all development, builds, demos, and verification on the user's Mac (M5, Chrome, WebGL2, Three.js 0.184, 60 fps @ ≈1728×1080). Remote-machine conventions stay retired.
6. **Preserve the sim architecture:** 120 Hz deterministic sim, replays, body-input with keyboard priority, assist ladder, autopilot, soft containment, tests — constants retune per Track E, architecture does not.
7. **One shared world, one style, one terrain dataset** — as defined in the master context §2.1/§3.5.
8. **Settled decisions stay settled** (master context §15.5). Where reports conflict with the decision record, the decision record wins; where reports conflict with each other, resolve by the master context's authority order and record the resolution explicitly in the implementation master.

## 4. Deliverable 1 — `BODYARCADE_SHARED_WORLD_IMPLEMENTATION_MASTER.md`

One consolidated specification containing at minimum:

1. **Authority and precedence** — the document stack and conflict rule, including the V1–V8 clause verbatim.
2. **The world contract** — coordinates/units (meters, y-up, sea level = y 0), region scale, the baked-data schema (from Track B), the single-source-of-truth data flow (baked terrain → render + collision + containment + water depth).
3. **The codebase plan** — `apps/shared-world/` scaffold per Track A's integration contract; the per-file preserve/replace/re-point manifest; the 0.172→0.184 port plan; test migration to local macOS.
4. **The water plan** — jeantimex vendored pristine at the pinned SHA; the minimal-edit adaptation spec (every changed shader/uniform, everything byte-identical by default); sim-resolution decision; the four-shot fidelity test procedure; the fallback ladder with escalation evidence requirements.
5. **The terrain and cave plan** — authoring tools, bake pipeline, runtime loader, LOD, the selected cave method, collision (Rapier heightfield + trimesh, three-mesh-bvh queries).
6. **The visual spec** — Track D's parameter tables (palettes, fog, visibility, caustics, lighting, particles, densities), scoped to checkpoint 8's underwater atmosphere pass and later approved tweaks.
7. **The movement/camera spec** — Track E's parameter targets and keep/retune/replace verdicts folded into the feel-constant table plan; the enjoyment acceptance criteria as checkpoint review items.
8. **The asset plan** — Track C's dolphin audit outcome, drop paths, the placeholder inventory (category → color code), the approved-asset list, `CREDITS.md` obligations, audio slice set.
9. **The checkpoint ladder** — the authoritative sequence (see §5), each checkpoint's scope, demo, verification, and approval gate.
10. **Performance budget** — Track B's frame-budget table as per-checkpoint assertions, with the degradation order (secondary density/effects degrade before water presentation, fog, dolphin animation, camera, terrain silhouettes, breach view) and pose-tracking headroom.
11. **Verification standard** — what every checkpoint session must produce: live local demo instructions (exact commands), summary of changes, placeholder inventory, performance report (fps, render resolution, frame-budget breakdown), deviations list, then **wait for review**.
12. **Open items and user actions** — consolidated from the five reports' Needs-user sections (e.g., region-sketch approval, fish models, PCSX2 captures).

## 5. Deliverable 2 — the checkpoint prompt sequence

Base the sequence on the master context §13.2 ladder (checkpoints 0–14), adjusted only where the research reports give concrete cause (record every adjustment and its cause in the implementation master):

0. Track-A-verified scaffold; jeantimex vendored pristine; stock demo runs locally unchanged.
1. The GAMICO dolphin swimming in the unmodified demo pool, driven by ported `sim.ts` + keyboard `swimControls`, animations playing, water interaction intact.
2. Camera work in the pool: above/below transitions, half-submerged behavior.
3. **Region-layout gate:** 2–3 top-down sketch maps; the user picks or redlines. *(A prompt that produces sketches and stops — no build.)*
4. Pool → bounded region (the canonical minimal edit); four-shot fidelity comparison.
5. Continuous terrain crossing the waterline; islands; shoreline masking verified above and below.
6. Breach, airborne framing, re-entry over the real region.
7. Color-coded placeholder blocks for every asset category per the approved layout.
8. **Ecco atmosphere pass A** (underwater only; surface stays pure jeantimex) per Track D.
9. Caves and overhangs via Track B's selected method.
10. Vegetation bakes replace vegetation placeholders.
11. Fish and ambient life motion (placeholders until user-supplied models arrive).
12. Ruins/architecture assets as supplied.
13. Minimal audio pass.
14. Rowing, Walking, and Flight views over the same region.

Also fold Track E's movement/camera retuning into the ladder where it belongs (likely checkpoints 1–2 for pool-scale feel and 4–6 for region-scale and breach feel) — as explicit scope lines, not vague "tune the feel."

**Each checkpoint prompt file must contain:**

1. **Header:** checkpoint number and name; what must already be true (previous checkpoint approved); the exact base branch/state.
2. **Scope:** exactly what to build in this checkpoint — and an explicit **out-of-scope list** (especially the next checkpoint's work).
3. **Inputs:** the exact files, report sections, assets, and parameter tables this checkpoint consumes (per the folder-07 rule: minimum context per session — name the specific attachments, never "attach everything").
4. **Specification:** every parameter pinned (values, paths, resource SHAs) — no implementer judgment. Placeholders per policy where assets are missing.
5. **Demo:** the exact way to run the local demo (commands, URL, what the user should see and try).
6. **Verification:** automated checks (tests to port/add, fps assertion, fidelity shots where applicable) and the manual review script for the user.
7. **The stop:** the mandatory end-of-checkpoint report (changes, placeholder inventory, performance, deviations) followed by **STOP — wait for user review and approval before any further visual change.** State explicitly that approval of this checkpoint does not authorize starting the next.
8. **Guardrails:** the binding rules from §3 restated in one short block (no invented assets, jeantimex minimal edits only, approved visuals immutable, local-only).

**Sizing rule:** each checkpoint must be completable in one focused implementation session and must end in a working, testable state — no "implement half now, half later" splits. If a §13.2 checkpoint is too large under the research findings, split it into sub-checkpoints (e.g., 4a/4b), each still demo-terminated and gated.

## 6. Output files and destinations

Write into `80_OUTPUTS/implementation-prompts/` in the bodyarcade-stage2-bundles bundle:

- `BODYARCADE_SHARED_WORLD_IMPLEMENTATION_MASTER.md`
- `CHECKPOINT_00_SCAFFOLD_AND_STOCK_DEMO.md`
- `CHECKPOINT_01_DOLPHIN_IN_THE_POOL.md`
- `CHECKPOINT_02_POOL_CAMERA.md`
- `CHECKPOINT_03_REGION_LAYOUT_GATE.md`
- `CHECKPOINT_04_POOL_TO_REGION.md`
- … continuing in the pattern `CHECKPOINT_NN_SHORT_NAME.md` through the full ladder (adjust names to your final sequence; keep numbering zero-padded and gapless; use suffixed numbers like `CHECKPOINT_04A_…` only for sanctioned splits).

Also write `CHECKPOINT_INDEX.md` in the same folder: the ordered list, one line per checkpoint (number, name, one-sentence scope, gate type — demo review vs decision gate).

## 7. Uncertainty and conflict rules

- Every parameter in the master and the checkpoint prompts traces to a source: a report section, the decision record, or the repository. Cite the source inline (document + section). If a needed value exists nowhere, do **not** invent it — put it in the open-items list and, if it blocks a checkpoint, mark that checkpoint blocked-pending-user-input.
- Carry the reports' measured/estimated labels forward: where a checkpoint builds on an estimate (e.g., a Track D fog density), the checkpoint's verification section must say the value is provisional and how the user confirms or corrects it at review.
- Record every conflict you resolved between reports, with the rule applied.
- Do not soften the visual target, re-open settled decisions, substitute resources, or add scope (no missions, sonar, multiplayer, weather, day/night).

## 8. Completion criteria

- [ ] Precondition check performed; all five reports confirmed present and complete (or the session stopped and reported the gap).
- [ ] `BODYARCADE_SHARED_WORLD_IMPLEMENTATION_MASTER.md` contains all twelve sections of §4, with the V1–V8 clause verbatim.
- [ ] Every checkpoint in the final ladder has its own prompt file with all eight elements of §5, ending in a runnable local demo and an explicit approval stop.
- [ ] Track E's feel retuning appears as explicit checkpoint scope; the enjoyment acceptance criteria appear as review items.
- [ ] `CHECKPOINT_INDEX.md` lists the full ordered sequence.
- [ ] Every parameter is source-cited; every unresolved value is in open-items, never invented.
- [ ] Deviations from the §13.2 ladder are recorded with their research-report cause.
- [ ] No code was written, no repository modified, nothing implemented.
- [ ] All files are written into `80_OUTPUTS/implementation-prompts/`.
