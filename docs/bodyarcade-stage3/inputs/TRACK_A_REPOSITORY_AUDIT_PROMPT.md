# Track A Research Prompt — Repository and Systems Audit

**Project:** BodyArcade Shared-World, Stage-2 research, Track A of five (A–E).
**Session type:** Repository-inspection research session with direct access to the live repositories (local filesystem clone or GitHub). Web access is helpful but secondary; the repositories are the primary evidence.
**You are a researcher, not an implementer.** You produce a report. You must not modify any repository, run destructive commands, create branches, or implement anything.

---

## 1. Mission

Produce a complete, evidence-backed map of what already exists in the BodyArcade/PosePuppet codebase, so that the Stage-3 implementation prompt can be written deterministically. Specifically:

1. What exists, verified directly against the repositories (never against old status tables).
2. What is **preserved** (systems and feel), what is **replaced wholesale** (presentation), and what is **re-pointed** (same mechanism, new data) — as a per-file manifest.
3. Exactly how the new vertical slice, working name `apps/shared-world/`, plugs into the monorepo: where it lives, how it is served, how body-input reaches it, how it is tested locally on macOS.
4. The true outcome of the already-executed V1–V8 prompt pack, prompt by prompt, from repository evidence.

## 2. Binding rule on the V1–V8 prompt pack (embed-verbatim clause)

The historical prompt pack is attached to your session as `04_HISTORICAL_V1_V8_PROMPT_PACK_ALREADY_RUN.txt`, governed by `03_V1_V8_ALREADY_RAN_WARNING.md`. The following user rule is binding:

> "The V1–V8 prompts in the attached prompt pack have already been run. Treat the prompt pack as historical planning context, not as instructions to execute again. Do not relaunch its waves, recreate completed work, or assume its status table is current. First inspect the attached results and the repository as it exists now, determine what each prompt actually completed, partially completed, or left unresolved, and continue only from the remaining gaps. Preserve working implementations and avoid rebuilding anything unless the audit finds a specific defect."

"The attached results" means the in-repo verification artifacts: the final verification summary committed on `local/v2-base-mac-prep @ 60b034c` and the Playwright eval outputs in `apps/dolphin/eval/`. Two policies stay retired no matter what the audit finds: the pack's Global Context v2 autonomy (no-user-gates) policy, and its remote-machine `DISPLAY=:2` conventions.

## 3. Required attachments and sources

Attach / provide access to:

| Item | Role |
|---|---|
| `00_BODYARCADE_MASTER_CONTEXT_V3.md` | Governing decision record. §4 (verified repo state), §15.1 (Track A spec), Addendum A. |
| `01_NEW_DECISIONS_TO_MERGE.md` | Newest decisions; governs over the master context body where they conflict. |
| `02_DESIGN_SOURCE_REPOSITORY_ARCHIVE_HISTORY.md` | Provenance of the design-source archive repo. |
| `03_V1_V8_ALREADY_RAN_WARNING.md` | Governing warning for the prompt pack. |
| `04_HISTORICAL_V1_V8_PROMPT_PACK_ALREADY_RUN.txt` | Historical evidence only. Never execute. |
| `github.com/lekandigital/posepuppet` | The live monorepo. Primary evidence. |
| `github.com/lekandigital/bodyarcade-current-design-source` | Design archive at commit `99df0bc`. Predates completed Dolphin/Rowing work — treat as archive, not current state. |

Repository ground truth — the branch/SHA table (verify each still resolves; report drift if any):

| Branch | SHA | Role |
|---|---|---|
| `local/v2-base-mac-prep` | `60b034c` | Newest baseline; likely working base — confirm. |
| `bodyarcade-dolphin-fable` | `05b4801` | Completed Dolphin. **Primary audit target.** |
| `bodyarcade-rowing-fable-rebuilt` | `c8cdafa` | Completed Rowing (donor). |
| `bodyarcade-rowing-fable` | `5ce96fa` | Earlier rowing branch. |
| `bodyarcade-flight-fable` | `07ec2f5` | Completed Flight (donor; TinySkies permission record). |
| `bodyarcade-v2-base` | `99df0bc` | v2 baseline (the extraction commit). |
| `bodyarcade-v4-base` | `493dd24` | **Unexamined — you must diff and explain it.** |
| `main` | `940d31c` | Merge Predictive Pose Continuity. |
| `ppc-complete` | `922077b` | PPC complete. |
| `feat/openworld`, `feat/world-data-v2`, `feat/walking-locomotion`, `feat/pose-runtime-hud`, `feat/character-control`, `feat/motion-memory-2`, `feat/recording-v2` | — | V1–V8 feature lanes; status unknown pending your audit. |

## 4. Evidence to inspect

1. **`apps/dolphin/` on `bodyarcade-dolphin-fable @ 05b4801` — exhaustively.** Every module: `src/game/{sim.ts, world.ts, decor.ts, dolphinMesh.ts, camera.ts, game.ts}`, `src/input/swimControls.ts`, `src/ui/{hud.ts, minimap.ts}`, `tests/{dolphin.spec.ts, topology.spec.ts}`, Playwright config, `eval/dolphin-results.json`, README.
2. **Root docs:** `ARCHITECTURE.md`, `BODYARCADE_CONTEXT.md`, `DECISIONS.md`, `PLAN.md`, `FUTURES.md`, `STUDY_NOTES.md`, `CLAUDE.md`.
3. **Donor branches:** the rowing branches (seated propulsion, steering authority, oar-water interaction, boat vehicle, rowing HUD) and the flight branch (vehicle, camera rig, altitude systems, and the TinySkies/GlobeFly written-permission record — verify `LICENSE_NOTES.md` exists and quote it).
4. **Shared packages:** `@bodyarcade/body-input` (API, versioning, capability negotiation), Predictive Pose Continuity, `@bodyarcade/world-data` (the OSM/ODbL dependency being retired with the fictional region).
5. **Monorepo tooling:** workspace layout, Vite configs, dev-server ports, how apps are served same-origin (the BroadcastChannel constraint), test tooling.
6. **The unexplained branches:** diff `bodyarcade-v2-base` vs `bodyarcade-v4-base` vs `local/v2-base-mac-prep`.
7. **The V1–V8 feature lanes**, mapped against the pack's own prompt list (likely correspondence to verify, never assume: V1 → `feat/pose-runtime-hud`; V2 → `feat/world-data-v2`; V3 → `feat/walking-locomotion`; V4 → `feat/openworld`; V5 → `feat/character-control`; V6 → `feat/motion-memory-2`; V7 → `feat/recording-v2`; V8 → likely docs/content, no dedicated branch).

## 5. Questions that must be answered

**The Dolphin app (preserve targets):**

1. What are the exact contents of the `sim.ts` feel-constant table — every constant, its value, its unit, and its role? (120 Hz fixed timestep, impulse-and-glide surge/attack/drag values, the 55 m containment band, seabed sampling, burst, breach thresholds, assist-ladder values.)
2. What is the containment/seabed sampling API surface — function signatures and data inputs — that must be re-pointed from the OSM SF-Bay polygon to an authored shoreline mask + baked heightfield?
3. What are the exact BodySignal message shapes, and what is the BroadcastChannel/postMessage topology, including the same-origin constraint? What does `apps/shared-world` need to do to receive body input?
4. What camera states/behaviors exist in `camera.ts`, and which are worth preserving for the new slice?
5. What does the Playwright harness assert, test by test (containment battery, replay determinism, breach positive/negative, dropout→glide recovery, transport topology, fps/simHz recording)? What in it assumes `DISPLAY=:2` or the remote box?
6. What is the Three.js 0.172 → 0.184 port surface for `sim.ts` + `swimControls.ts`? (Expected minimal since the sim is render-free — verify by enumerating every Three.js import/usage in the preserve set.)
7. Which feel constants were tuned for bay-scale and will likely need re-tuning at the 2 km region scale? List each with its current value and why scale affects it. (Do **not** propose new values — Track E owns feel targets.)

**The wider repo:**

8. What is `bodyarcade-v4-base` (`493dd24`)? What does it add/change relative to `bodyarcade-v2-base` and `local/v2-base-mac-prep`?
9. Is `local/v2-base-mac-prep @ 60b034c` the right base branch for `apps/shared-world`? If a different base or location is better, justify it — you may propose a better location, **not** a different strategy.
10. For each of V1–V8: what did it actually complete, partially complete, or leave unresolved, per repository evidence? Is any remaining gap still wanted under the current plan, or is it superseded? (Note: V4's "three style profiles" deliverable is superseded by the one-style decision even if fully built — say so explicitly rather than marking it "complete.")
11. What do Rowing and Flight offer as future donors (vehicle patterns, buoyancy, oar-water interaction, camera rigs, altitude), and where does each donor system live (file paths)?
12. What is the complete local-macOS verification migration: everything that assumes the remote GPU/`DISPLAY=:2`, and its local replacement (Playwright on macOS Chrome, screenshots, fps assertions)?
13. How is `@bodyarcade/body-input` versioned and consumed, and what capability negotiation exists? What must `apps/shared-world` declare?
14. Anything undocumented or surprising — uncommitted-looking artifacts, drift between docs and code, license obligations beyond ODbL/TinySkies, secrets or CI assumptions?

## 6. Required tables and deliverables

Your report must contain, at minimum:

1. **Architecture map** — monorepo layout, packages, apps, data flow from webcam → pose inference → BodySignal → game, and where `apps/shared-world` attaches.
2. **Per-file preserve / replace / re-point manifest** for `apps/dolphin/` — columns: file; verdict (preserve / replace / re-point / ignore); reason; dependencies; port notes.
3. **Feel-constant table dump** — every constant in `sim.ts` with value, unit, role, and a scale-sensitivity flag.
4. **Port plan** — 0.172 → 0.184 steps for the preserve set, with every touched line category enumerated.
5. **`apps/shared-world` integration contract** — location, package name, Vite/dev-server setup, same-origin serving for BroadcastChannel, body-input consumption, test wiring.
6. **Test-migration plan** — each existing assertion worth carrying forward, and the local-macOS replacement for every remote-machine assumption.
7. **V1–V8 outcome table** — columns: prompt; branch/commit evidence (SHAs); verdict (completed / partial / unresolved / superseded / absent); what remains; whether the remainder is still wanted.
8. **Branch disposition table** — every branch in §3, what it is, and whether the new work reads from it, ignores it, or supersedes it.
9. **Donor-systems inventory** — Rowing/Flight/walking systems with file paths and reuse notes.
10. **Findings list** — everything undocumented or surprising, each with evidence.
11. **Answered / Open / Needs-user** section at the end, per the global format rule.

## 7. Uncertainty and citation rules

- Cite repository evidence precisely: branch, SHA, file path, and line range where practical. Quote READMEs and docs rather than paraphrasing when the wording matters.
- Never trust an old status table, README claim, or the prompt pack's self-description without checking the code. Where a claim and the code disagree, report both and flag the discrepancy.
- Mark every judgment call as **inference** and every directly observed fact as **verified**. Mark anything you could not check (e.g., a branch that no longer resolves) as **unverifiable** with what you tried.
- Do not re-open settled decisions (master context §15.5). Do not propose substitute resources, styles, or strategies. If you find a genuinely disqualifying fact, report the fact and label any alternative as a clearly-marked proposal.
- No re-asking of questions the master context answers.

## 8. Output

- **Exact output filename:** `TRACK_A_REPOSITORY_AUDIT_REPORT.md`
- **Destination:** `80_OUTPUTS/research-reports/` in the bodyarcade-stage2-bundles bundle.
- Markdown with tables. Begin with a one-page executive summary. End with the Answered / Open / Needs-user section.

## 9. Completion criteria

The report is complete when all of the following are true:

- [ ] Every question in §5 is answered with cited repository evidence, or explicitly marked open/unverifiable with reasons.
- [ ] All eleven deliverables in §6 are present.
- [ ] The V1–V8 outcome table covers all eight prompts with branch/commit evidence, and nothing verified working is recommended for rebuild without a specific documented defect.
- [ ] `bodyarcade-v4-base` is explained or explicitly declared unexplainable with evidence of the attempt.
- [ ] The preserve/replace/re-point manifest covers every file in `apps/dolphin/`.
- [ ] The integration contract is concrete enough that Stage 3 can scaffold `apps/shared-world` without any further repo inspection.
- [ ] No repository was modified; no prompt-pack instruction was executed.
- [ ] The report is written to `TRACK_A_REPOSITORY_AUDIT_REPORT.md`.
