# Remote Development Policy

## Remote Development Authority
- Primary feature implementation occurs on the remote Ubuntu checkout.
- The remote checkout owns the currently active development branch while an agent is working.
- The local Mac checkout is read-only for that active branch except when synchronizing completed commits or performing an explicitly approved correction.
- Never edit the same active branch independently on both machines.
- Use coherent checkpoint commits.
- Do not merge or push without explicit user approval.
- Do not rewrite accepted history.

## Remote Responsibilities
- implementation
- dependency installation
- builds
- linting
- type-checking
- unit and integration tests
- fixture processing
- deterministic replay
- pose evaluation
- Playwright
- screenshots
- headless-browser validation
- automated performance checks
- development-server operation
- preparing the final local-test handoff

## Local Mac Responsibilities
- physical webcam input
- actual Apple Silicon execution
- actual Chrome and Safari execution
- actual local WebGL behavior
- actual MediaPipe performance
- subjective latency and responsiveness
- control feel
- fatigue
- comfort
- nausea
- final user acceptance

## Fixture-First Development
- The user is willing to record videos needed for development.
- Request all known fixture recordings as early as practical and preferably in one batch.
- Specify exact filenames, standing or seated, framing, resolution, frame rate, duration, motion counts, movement form, required stillness before and after.
- Validate each fixture before relying on it.
- Do not claim a fixture result when the fixture is missing or invalid.
- Keep private fixture recordings untracked.
- Convert private fixtures to derived test formats in ignored cache directories only.

## Testing Cadence
- Do not repeatedly interrupt feature implementation for intermediate live testing.
- Replace intermediate manual gates with honest automated engineering checkpoints wherever possible.
- After required fixtures are supplied, complete implementation and automated verification remotely.
- Ask the user to test locally only at the final gate for the current major feature or prompt.
- Stop early only for a genuine user-dependent blocker.
- A failed automated test is not a reason to ask the user to test; fix it remotely first.
- Do not infer final user approval.

## Final Remote-to-Local Handoff
Before requesting local testing, the agent must:
1. run the full applicable remote test suite;
2. report every command and result;
3. distinguish passed, failed, skipped, and unavailable tests;
4. state the current commit;
5. state the current branch;
6. confirm the working tree state;
7. start the remote server on loopback only;
8. verify the server process and routes;
9. verify that PosePuppet and the feature route share the intended origin;
10. provide the exact Mac SSH-tunnel command;
11. provide the local browser URL;
12. provide the exact local test sequence;
13. explain what each local test is validating;
14. identify known limitations or deferred work;
15. wait for the user's response after each meaningful manual test;
16. use the testing conversation to prepare the final acceptance report.

## Server Policy
- Bind remote servers to 127.0.0.1 only.
- Never bind to 0.0.0.0 unless explicitly authorized.
- Never expose the development server through router or firewall configuration.
- Access the server through an SSH local-forward.
- Preserve localhost webcam permissions.
- Preserve same-origin behavior for PosePuppet, Flight, Rowing, and body-input transport.
- Use persistent process management that survives SSH disconnection.
- Stop only the project-owned process.

## Process Safety
- Never use pkill, killall, fuser -k, or broad process-name termination.
- Never kill a process based solely on a port number.
- Use the dedicated tmux session (posepuppet-dev) and recorded PID files.
- Send SIGINT first, then SIGTERM, then SIGKILL only for verified project-owned descendants.

## Git Synchronization Safety
- Use Git bundles for unpushed work synchronization.
- Never use git reset --hard.
- Never use git clean -fd.
- Never force-push.
- Always verify fast-forward ancestry before updating.
- Always create timestamped backup refs before updating.
- Never leave .bundle files in the repository root.
- Store bundles in ~/.local/state/posepuppet/bundles/ or similar ignored paths.

## Test Integrity
- Never weaken test assertions to make them pass under SwiftShader or any environment.
- Never use `|| echo` or `|| true` to swallow test failures.
- Use explicit SKIP_EXPECTED or ENVIRONMENT_BLOCKED classifications for genuinely optional or environment-limited checks.
- Preserve original performance thresholds; classify SwiftShader performance failures as ENVIRONMENT_BLOCKED.
- Final performance validation happens on Apple Silicon.

## Cross-Platform Policy
- Linux/x86/NVIDIA success does not prove macOS/ARM/Metal success.
- Never move node_modules between platforms.
- Never use remote RTX performance as the final product benchmark.
- Final acceptance always includes one representative Apple Silicon test.
- Performance-sensitive features should support scalable quality where appropriate.
