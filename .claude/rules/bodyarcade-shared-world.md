# BodyArcade Shared-World Operating Rules

These rules apply to work on the `bodyarcade-shared-world` branch and especially to
`apps/shared-world/` and `docs/bodyarcade-stage3/`.

## Checkpoint discipline

- Implement exactly one checkpoint per implementation session.
- Before modifying anything, verify the requested worktree, branch, exact starting
  HEAD, clean working tree, and required approved-commit ancestry.
- If a precondition fails, stop and report it without changing files.
- Read the current checkpoint document, Implementation Master, and all inputs named
  by the launch prompt in full.
- The current checkpoint defines the allowed scope. Do not begin the next checkpoint.
- Preserve every previously approved checkpoint unless the user explicitly reopens it.
- Do not reinterpret, redesign, or silently improve an approved decision.
- Record material deviations, derived tolerances, and unresolved issues honestly.
- Do not weaken tests to obtain a passing result.
- Do not modify vendored donor code unless the checkpoint explicitly authorizes it.
- Commit completed checkpoint work locally.
- Do not push, merge, rebase, open a pull request, or alter remote branches unless
  the user explicitly authorizes that action.
- After the checkpoint report and local commit, stop for user review.

## Physical camera and body input

- Physical webcam access is disabled by default during development and automated
  verification.
- Do not call `navigator.mediaDevices.getUserMedia()` merely because a page loads.
- Do not automatically initialize physical-camera tracking.
- Do not trigger camera or microphone permission prompts during routine development.
- Use keyboard controls, deterministic replay, fixture video, recorded signals, or
  mocked body-input data.
- Preserve normal production physical-camera support and body-input semantics.
- Do not permanently grant or deny browser or macOS permissions as a workaround.
- Keyboard fallback must continue to function when camera permission is unavailable.
- A checkpoint may use a physical camera only when the user explicitly requests a
  live-camera test for that checkpoint.

## Headed browser workflow

- Use a dedicated BodyArcade Chrome profile, never the user's normal Chrome profile.
- Reuse one persistent headed development window and the existing relevant tab.
- Prefer Vite hot reload instead of repeatedly opening windows or tabs.
- Do not create duplicate headed Chrome instances.
- Do not repeatedly steal focus, maximize, reposition, close, or reopen the window.
- Machine-specific profile paths, display coordinates, permissions, and window-state
  files must remain local and untracked.

## Testing workflow

- Run routine correctness, deterministic, unit, integration, replay, and regression
  testing headlessly when the test is valid headlessly.
- Keep routine headless automation separate from the persistent headed development
  window.
- Use headed testing when browser visibility, WebGL behavior, real rendering cadence,
  screenshots, visual fidelity, or performance evidence requires it.
- Final headed performance evidence must come from a visible, unminimized, unoccluded
  window. Do not accept background-throttled results as final evidence.
- Batch headed screenshots, visual checks, and performance measurements into as few
  foreground interactions as practical.
- State which viewport and environment produced every reported performance number.
- Do not claim the user completed a formal manual checklist.
- After every visual or interactive checkpoint, the user may explore freely for as
  long as they choose and report anything that looks or feels wrong.
- Formal comprehensive scenario testing, edge-case sweeps, and cross-checkpoint manual
  regression testing are deferred to the final dedicated testing phase unless a
  checkpoint explicitly requires a narrower acceptance gate.
- Automated checkpoint verification still runs at every checkpoint.

## Scope and reporting

- Inspect every changed, created, deleted, staged, and untracked path before committing.
- Keep generated artifacts deterministic when the checkpoint requires determinism.
- Do not commit personal footage, local browser profiles, permissions, machine paths,
  temporary screenshots, or display-management state.
- Preserve truthful limitations and distinguish completed checks from deferred checks.
