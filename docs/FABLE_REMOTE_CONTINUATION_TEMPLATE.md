# Fable Remote Continuation

This project uses a remote development workflow. You are expected to work on the remote machine.

1. Read `CLAUDE.md`, `CLAUDE.local.md`, `.claude/rules/remote-development.md`, `BODYARCADE_CONTEXT.md`, `FUTURES.md`, the active feature prompt, and relevant notes.
2. Verify you are on the correct active branch (e.g., `bodyarcade-rowing-fable`).
3. Run the remote doctor script: `./scripts/remote/doctor.sh`.
4. Run baseline tests to verify the suite is green: `./scripts/remote/test-all.sh`.
5. Continue the active feature prompt (e.g. Rowing implementation).
6. Preserve accepted Flight and Predictive Pose Continuity behavior.
7. Use supplied fixtures (under `fixtures/`) for implementation and evaluation.
8. Avoid repeated manual gates; do not ask the user to perform intermediate physical tests. Ask only when a real user-dependent blocker exists.
9. Commit coherent checkpoints locally on the remote. Do not merge or push.
10. Run all applicable tests after changes (`./scripts/remote/test-all.sh`).
11. Start the loopback server: `./scripts/remote/start-arcade.sh`.
12. Return a final local-test handoff using the template in `docs/FINAL_LOCAL_TEST_TEMPLATE.md`.
