BODYARCADE — GLOBAL CONTEXT v2 (read before any prompt)

STATE: COMPLETED and working — body-input protocol, Predictive Pose
Continuity, TinySkies Flight (Track F, permission recorded), Rowing,
standalone PS2 Dolphin, plus PosePuppet's full creative app and its
fixture/fake-webcam/eval rig. Audit-then-reuse: never rebuild a completed
system; if an audit finds a concrete gap, fix minimally and log it.

PRODUCT SHAPE: TinySkies stays its own whimsical globe-flight experience.
New real-world experiences are ONE Open World: one compact baked region,
three renderer/content profiles (low-poly, realistic, fantasy-game) over
the SAME geographic data. Dolphin exists only in the low-poly/PS2
profile. PosePuppet splits into Runtime (headless tracking), HUD (shared
overlay), and the Full App (creative instrument, unchanged in role).

AUTONOMY POLICY (replaces all user gates): implement end-to-end without
asking me to test. Verify yourself: unit, integration, fixture, replay,
Playwright fake-webcam, performance, screenshot boards, and vision
self-review of your own recordings. Record every human-only check as a
structured entry in the shared FINAL_USER_TEST_PLAN.md (format defined
there) with links to the automated evidence you already collected. Stop
ONLY for: (1) a genuine licensing issue, (2) a missing required private
asset with no placeholder path, (3) a destructive/irreversible action,
(4) an irreducible product decision that cannot safely be assumed.
Otherwise: make the best-effort assumption, one line in DECISIONS.md,
keep moving. Missing fixtures never block: use synthetic streams,
existing fixtures, or placeholders, and defer real-media validation to
the final plan.

ISOLATION: work in your assigned worktree/branch/tmux/port (table in the
pack). Own only your declared files/packages; interface changes to
shared packages go through a one-page RFC applied by a single owner.
Locks: flock /tmp/bodyarcade-display2.lock for headed DISPLAY=:2 GPU
runs; flock /tmp/bodyarcade-fullsuite.lock for full-suite runs and
merges. Headless correctness runs anytime; performance numbers only from
headed runs on :2.

STANDING RULES: local/private — no backend, analytics, telemetry, or
uploads; raw landmarks never cross the tracking boundary (derived
signals only). Keyboard fallback wherever a body control exists, and
keyboard MUST work when camera permission is denied. Licensing: every
asset in ASSETS.md; OSM/ODbL attribution on-screen in real-world
profiles; TinySkies credit preserved. Truthfulness: every claimed number
traces to eval/results.json or logs. VISUAL DESIGN IS FROZEN: preserve
the current PosePuppet visual language; minimal feature-specific UI only
where usability/accessibility/diagnostics require it; a custom design
pass happens separately and later — never block function on visuals.
Performance floors from completed passes hold unless a prompt states new
ones. Conventions: conventional commits, DECISIONS.md, STATUS.md every
~2h, EVAL_NOTES.md per milestone. fixtures/ stays gitignored.
