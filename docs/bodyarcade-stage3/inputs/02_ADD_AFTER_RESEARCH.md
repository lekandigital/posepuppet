# Stage 3 — Files to Add After Research Completes

After all five research tracks are complete, add the following files to this folder before running the Stage-3 implementation-prompt-writer session:

## Research Prompts (from 80_OUTPUTS/research-prompts/)

- TRACK_A_REPOSITORY_AUDIT_PROMPT.md
- TRACK_B_WATER_TERRAIN_CAVES_PROMPT.md
- TRACK_C_ASSETS_AUDIO_DOLPHIN_PROMPT.md
- TRACK_D_PS2_VISUAL_SPEC_PROMPT.md
- TRACK_E_ECCO_MOVEMENT_CAMERA_FEEL_PROMPT.md

## Research Reports (from 80_OUTPUTS/research-reports/)

- TRACK_A_REPOSITORY_AUDIT_REPORT.md
- TRACK_B_WATER_TERRAIN_CAVES_REPORT.md
- TRACK_C_ASSETS_AUDIO_DOLPHIN_REPORT.md
- TRACK_D_PS2_VISUAL_SPEC_REPORT.md
- TRACK_E_ECCO_MOVEMENT_CAMERA_FEEL_REPORT.md

## What the Stage-3 Session Produces

The Stage-3 implementation-prompt-writer session will produce:

1. **BODYARCADE_SHARED_WORLD_IMPLEMENTATION_MASTER.md** — a single consolidated implementation document synthesizing all five research reports into a complete, deterministic specification.

2. **A sequence of checkpoint prompt files** — each checkpoint is a self-contained implementation step that:
   - ends in a locally runnable demo;
   - can be verified before proceeding to the next checkpoint;
   - requires user review before any major visual change.

## Rules

- The Stage-3 session writes prompts and specifications only. It does **not** implement anything.
- Each checkpoint must produce a working, testable state — no "implement half now, half later" splits.
- The user reviews and approves before advancing to the next major visual milestone.
