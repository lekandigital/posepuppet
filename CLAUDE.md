# PosePuppet / BodyArcade — Current Claude Code Instructions

@.claude/rules/bodyarcade-shared-world.md
@~/.claude/bodyarcade-shared-world-local.md

## Current branch authority

The `bodyarcade-shared-world` branch implements the staged BodyArcade shared-world
plan under:

- `apps/shared-world/`
- `docs/bodyarcade-stage3/`

For shared-world checkpoint work, authority is ordered as follows:

1. The user's current launch prompt.
2. The current checkpoint document.
3. `BODYARCADE_SHARED_WORLD_IMPLEMENTATION_MASTER.md`.
4. Approved decisions recorded by earlier checkpoints.
5. `.claude/rules/bodyarcade-shared-world.md`.
6. Supplemental research and historical project documents.

Read every file required by the current checkpoint in full before modifying code.

The previous root instructions for PosePuppet Pass 2 were archived at:

`docs/archive/CLAUDE_POSEPUPPET_INSTRUMENT_PASS.md`

They are historical context only on this branch. In particular, their prohibitions
against games, worlds, flight, rowing, and shared-world implementation do not apply
to the authorized BodyArcade shared-world checkpoints.

`BODYARCADE_CONTEXT.md`, `FINAL_USER_TEST_PLAN.md`, `EVAL_NOTES.md`, and
`DECISIONS.md` contain useful history, but they do not override the current Stage-3
Implementation Master, checkpoint document, approved checkpoint decisions, or the
user's current instructions.

The older `BODYARCADE_CONTEXT.md` autonomy policy does not replace Stage-3 user
decision gates. Every checkpoint must stop for user review and approval when its
checkpoint document requires that stop.

Read `.claude/rules/remote-development.md` only when the work is actually being
performed on the remote development machine.
