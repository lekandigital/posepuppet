# Fable Remote Continuation

This project uses a remote development workflow. You are expected to work on the remote machine.

## Before Starting
1. Read `CLAUDE.md`, `CLAUDE.local.md`, `.claude/rules/remote-development.md`, `BODYARCADE_CONTEXT.md`, `FUTURES.md`, the active feature prompt, and relevant notes.
2. Verify you are on the correct active branch.
3. Run `./scripts/remote/doctor.sh` to verify the environment.
4. Run `./scripts/remote/test-all.sh` to establish a green baseline.

## During Implementation
5. Continue the active feature from its actual current state.
6. Preserve accepted Flight and Predictive Pose Continuity behavior.
7. Use supplied fixtures (under `fixtures/`) for implementation and evaluation.
8. Avoid repeated manual gates — do not ask the user to perform intermediate physical tests. Ask only when a real user-dependent blocker exists.
9. Commit coherent checkpoints locally on the remote. Do not merge or push.
10. Run `./scripts/remote/test-all.sh` after changes.

## Before Handoff
11. Run the full applicable test suite and review the baseline report.
12. Start the loopback server: `./scripts/remote/start-arcade.sh`.
13. Verify routes with `./scripts/remote/status.sh`.
14. Return a final local-test handoff using the template in `docs/FINAL_LOCAL_TEST_TEMPLATE.md`.

## Test Integrity
- Do not weaken assertions to make tests pass under SwiftShader.
- Do not use `|| echo` or `|| true` to swallow failures.
- Classify SwiftShader performance limitations as ENVIRONMENT_BLOCKED.
- Preserve original performance thresholds for Apple Silicon final validation.

## SwiftShader Note
Remote Playwright uses software rendering (SwiftShader) for functional validation. It is not a performance benchmark. If `poseFps > 5` fails under SwiftShader, that is expected — the threshold is correct and must pass on Apple Silicon.
