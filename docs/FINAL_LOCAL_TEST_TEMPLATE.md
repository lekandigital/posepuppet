# Final Local Test Handoff

Please perform the following manual test to accept the feature:

## What Changed
- (Agent to describe changes)
- What was intentionally unchanged

## System State
- **Branch**: (branch name)
- **Commit**: (hash)
- **Tests**: (summary of pass/fail/skip with counts)
- **Fixtures validated**: (yes/no, with count)
- **Server status**: RUNNING on 127.0.0.1:5173
- **Tunnel command**: `./scripts/local/remote-tunnel.sh`
- **Local URL**: `http://localhost:5173`

## Manual Actions Required
1. Open the tunnel: `./scripts/local/remote-tunnel.sh`
2. Open Chrome: navigate to `http://localhost:5173`
3. (Feature-specific test steps)
4. Open Safari: repeat key tests

## Expected Result
- (What should happen for each step)

## Checks
- [ ] Chrome: webcam tracking works
- [ ] Chrome: feature-specific behavior correct
- [ ] Chrome: performance acceptable
- [ ] Safari: feature loads and tracks
- [ ] Comfort: no nausea or eye strain
- [ ] Control feel: responsive and intuitive
- [ ] (Feature-specific checks)

## Observed Result
- (User to fill in)

## Decision
- [ ] Pass — accept and proceed
- [ ] Fail — describe issues for remote fix

## Deferred Work
- (List of deferred items)

## Obstacle-Avoidance Decision
- (If a navigable mode was changed, explicitly evaluate obstacle avoidance)
