# Remote Development Workflow

PosePuppet features are implemented remotely on an Ubuntu workstation and tested finally on Apple Silicon. This ensures a clean, repeatable build environment while guaranteeing the final product is validated on the target platform (Apple Silicon, Safari, local MediaPipe performance, and physical comfort).

## Architecture

- **Remote (Ubuntu/x86/NVIDIA)**: Implementation, builds, type checking, automated testing, Playwright, fixture processing, dev server hosting.
- **Local (Mac/Apple Silicon)**: Final acceptance testing — real webcam, real browser, real performance, subjective evaluation.

## First-Time Setup

1. Create `.env.remote.local` with remote machine credentials (see template below).
2. Create `CLAUDE.local.md` with machine-specific notes.
3. Run `scripts/remote/install.sh` on the remote to install dependencies.
4. Sync fixtures with `scripts/local/sync-private-fixtures.sh`.
5. Run `scripts/remote/doctor.sh` to verify the remote environment.

## Daily Workflow

1. Sync source via `scripts/local/sync-git-bundle.sh` (supports `--dry-run`).
2. SSH in via `scripts/local/remote-shell.sh` or use remote SSH tools.
3. Run `scripts/remote/doctor.sh` and `scripts/remote/test-all.sh` to verify baseline.
4. Implement features on the remote checkout.
5. Run `scripts/remote/test-all.sh` after changes.
6. Start the server: `scripts/remote/start-arcade.sh`.
7. Generate handoff: `scripts/remote/print-handoff.sh`.

## Synchronization

- **Source code**: Git bundles via `scripts/local/sync-git-bundle.sh`. Never rsync tracked source.
- **Fixtures**: rsync via `scripts/local/sync-private-fixtures.sh`. Fixtures are git-ignored private webcam recordings.
- **Dependencies**: `node_modules` are never transferred between environments.

## Final Test Gate

After remote work is complete, the user connects via SSH tunnel:
```bash
./scripts/local/remote-tunnel.sh
```
The user performs physical evaluation (feel, nausea, comfort, real latency) on the Mac.

## Network Exposure

- The remote server only binds to `127.0.0.1`. It is never exposed to `0.0.0.0`.
- Access is strictly via SSH local port forwarding.
- No firewall, router, or public tunnel changes are ever made.

## SwiftShader and Performance Testing

Remote Playwright tests use ANGLE SwiftShader for functional validation. This is a software renderer — it verifies correctness, not performance. Original performance thresholds (e.g., `poseFps > 5`) are preserved unchanged. If SwiftShader cannot satisfy a performance threshold, that check is classified `ENVIRONMENT_BLOCKED` — it is not a product failure and is not hidden by weakening the assertion. Final performance validation always occurs on Apple Silicon.
