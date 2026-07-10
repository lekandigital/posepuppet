# Remote Development Workflow

PosePuppet features are implemented remotely and tested finally on Apple Silicon. This ensures the environment is clean, repeatable, and avoids polluting the local host with dependencies, while guaranteeing the final product is validated on the target platform (Apple Silicon, Safari, local MediaPipe performance, and physical comfort).

## First-time Setup
The infrastructure establishes:
- Local `CLAUDE.local.md` and `.env.remote.local` with private details.
- Remote repository clone via Git bundles to ensure identical history.
- Helper scripts for day-to-day work.
- Remote node setup and Playwright deps.

## Daily Remote-Agent Workflow
1. Fable begins work by running `scripts/local/remote-shell.sh` to SSH in, or by using remote SSH tools directly.
2. The agent runs `scripts/remote/doctor.sh` and `scripts/remote/test-all.sh` to establish a baseline.
3. Feature implementation happens exclusively on the remote checkout.
4. The active branch is owned by the remote checkout while work is underway.
5. Fable uses fake-camera tests with pre-processed fixtures to validate features.
6. When implementation and automated tests are complete, Fable starts the server using `scripts/remote/start-arcade.sh`.
7. Fable generates a handoff report for the user.

## Synchronization
- **Source code**: Synchronized via `scripts/local/sync-git-bundle.sh` or `git fetch` natively. We never `rsync` tracked source code, we use git bundles for unpushed work.
- **Fixtures**: Synchronized via `scripts/local/sync-private-fixtures.sh`. The `fixtures/` directory remains git-ignored and contains private webcam recordings.
- **Dependencies**: `node_modules` are never transferred between environments.

## Final Test Gate
After Fable finishes, the user connects via SSH tunnel:
```bash
./scripts/local/remote-tunnel.sh
```
The user performs physical evaluation (feel, nausea, comfort, real latency) on the Mac.
If changes are needed, Fable iterates remotely.

## Network Exposure
- The remote server only binds to `127.0.0.1`. It is never exposed to `0.0.0.0`.
- Access is strictly via SSH local port forwarding.

## Obstacle-Avoidance Reminder
For navigation modes like Rowing, Dolphin, Walking World, or Flight:
Explicitly evaluate and make a deliberate product decision on obstacle avoidance at the final gate. Look out for shoreline collisions, getting trapped, oscillation, and soft guidance.
