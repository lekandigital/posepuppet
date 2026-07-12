// Fixture eval: drives each fixtures/flight clip through the app as a fake
// webcam, collects the emitted BodySignal stream, and runs per-fixture
// assertions (episode-structural — no hardcoded timestamps). Results into
// eval/bodyinput-results.json; nonzero exit if any check fails.
//
//   node packages/body-input/tools/fixture-eval.mjs [lean_lr …] [--headless]
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..', '..');
// PP_PORT: 5173 on a shared box can belong to a DIFFERENT checkout's
// persistent server (the Dolphin-lane lesson) — lanes pin their own port.
const PP_PORT = process.env.PP_PORT ?? '5173';
const BASE = `http://localhost:${PP_PORT}`;

const DURATIONS = {
  lean_lr: 40, lean_fb: 60, crouch_stand: 45, arms_tpose: 42, seated: 40, still: 20,
  // rowing clips: single-pass video-file mode (see below) — the value is
  // only a poll timeout ceiling, collection ends when the clip does
  rowing_slow: 55, rowing_fast: 45, rowing_left_bias: 60, rowing_seated: 40,
  rowing_seated_upper: 40,
};

/** Hand-labeled stroke counts (recording protocol, 2026-07-07) — the ±1
 *  eval bar. rowing_seated: the protocol prescribed 15, but the take
 *  contains 13 completed pulls — raw wrist trace shows a ~2.5 s pause at
 *  14–16.5 s and the clip starts mid-stroke; frame-sheet review agrees
 *  (EVAL_NOTES 2026-07-09). 13 is the measured label, PENDING LEKAN'S
 *  CONFIRMATION at Gate 2. */
const STROKE_TRUTH = {
  rowing_slow: 12, rowing_fast: 24, rowing_left_bias: 15, rowing_seated: 13,
  // chest-up crop of rowing_seated (same 13 pulls) — the Gate-2 live seated
  // report framing: propulsion must not depend on leg visibility
  rowing_seated_upper: 13,
};

const argv = process.argv.slice(2);
const headless = argv.includes('--headless');
const liteModel = argv.includes('--model=lite');
const names = argv.filter((a) => !a.startsWith('--'));
const fixtures = names.length ? names : Object.keys(DURATIONS);

// --- schema guard (mirrors src/schema.ts — the tool is plain .mjs) -------
const TOP = ['v', 'ts', 'confidence', 'seated', 'stillness', 'neutralConfidence', 'axes', 'events'];
const AXES = ['leanX', 'leanY', 'crouch', 'tallness', 'armsOut', 'armsRaised', 'handsForward', 'handPoint'];
const STROKE = ['active', 'count', 'rate', 'phase', 'ampL', 'ampR'];
const SWIM = ['active', 'count', 'rate', 'phase', 'amp'];
const GAIT = ['active', 'count', 'cadence', 'phase', 'amp', 'shift', 'source'];
function checkShape(s) {
  // 'tracking', 'stroke', 'swim' and 'gait' are the schema's optional additive blocks
  const keys = Object.keys(s)
    .filter((k) => k !== 'tracking' && k !== 'stroke' && k !== 'swim' && k !== 'gait').sort().join();
  if (keys !== [...TOP].sort().join()) return `keys ${keys}`;
  if (s.v !== 1) return `v=${s.v}`;
  for (const k of ['ts', 'confidence', 'stillness', 'neutralConfidence']) {
    if (!Number.isFinite(s[k])) return `${k} not finite`;
  }
  if (Object.keys(s.axes).sort().join() !== [...AXES].sort().join()) return 'axes keys';
  for (const k of AXES) if (!Number.isFinite(s.axes[k])) return `axes.${k} not finite`;
  if (s.stroke !== undefined) {
    if (Object.keys(s.stroke).sort().join() !== [...STROKE].sort().join()) return 'stroke keys';
    if (typeof s.stroke.active !== 'boolean') return 'stroke.active not boolean';
    for (const k of ['count', 'rate', 'phase', 'ampL', 'ampR']) {
      if (!Number.isFinite(s.stroke[k])) return `stroke.${k} not finite`;
    }
  }
  if (s.swim !== undefined) {
    if (Object.keys(s.swim).sort().join() !== [...SWIM].sort().join()) return 'swim keys';
    if (typeof s.swim.active !== 'boolean') return 'swim.active not boolean';
    for (const k of ['count', 'rate', 'phase', 'amp']) {
      if (!Number.isFinite(s.swim[k])) return `swim.${k} not finite`;
    }
  }
  if (s.gait !== undefined) {
    if (Object.keys(s.gait).sort().join() !== [...GAIT].sort().join()) return 'gait keys';
    if (typeof s.gait.active !== 'boolean') return 'gait.active not boolean';
    for (const k of ['count', 'cadence', 'phase', 'amp', 'shift']) {
      if (!Number.isFinite(s.gait[k])) return `gait.${k} not finite`;
    }
    if (!['legs', 'sway', 'none'].includes(s.gait.source)) return `gait.source=${s.gait.source}`;
  }
  return null;
}

/** Gait NEGATIVE assertion (V3 Walking): none of the existing clips
 *  contain marching or weight-shift walking, so steps counted here are
 *  false positives. maxSteps tolerates boundary artifacts where noted.
 *  Positive gait evals need the march/weight_shift fixtures — OPTIONAL
 *  per the V3 prompt, tracked in FINAL_USER_TEST_PLAN S8. */
function gaitNegative(signals, maxSteps, note = '') {
  const steps = (signals[signals.length - 1]?.gait?.count ?? 0) - (signals[0]?.gait?.count ?? 0);
  const activeFrames = signals.filter((s) => s.gait?.active).length;
  const amps = [];
  const sources = [];
  let prev = signals[0]?.gait?.count ?? 0;
  for (const s of signals) {
    const c = s.gait?.count ?? prev;
    if (c > prev) {
      amps.push(s.gait.amp);
      sources.push(s.gait.source);
    }
    prev = Math.max(prev, c);
  }
  return {
    gaitFalsePositives: {
      pass: steps <= maxSteps,
      detail: `${steps} gait steps (amps: ${amps.map((a) => a.toFixed(3)).join(', ') || '—'}; src: ${sources.join(',') || '—'}), ${activeFrames} rhythm-active frames on non-walking footage (≤${maxSteps})${note}`,
      steps,
      amps,
    },
  };
}

/** Torso-wave (swim) NEGATIVE assertion: none of the existing clips
 *  contain a deliberate dolphin kick, so kicks counted here are false
 *  positives. maxKicks tolerates a single boundary artifact where noted.
 *  Positive kick evals need the torso_wave fixtures — a USER ACTION
 *  tracked in FINAL_USER_TEST_PLAN.md, not fabricated here. */
function swimNegative(signals, maxKicks, note = '') {
  const kicks = (signals[signals.length - 1]?.swim?.count ?? 0) - (signals[0]?.swim?.count ?? 0);
  const activeFrames = signals.filter((s) => s.swim?.active).length;
  // amplitude of each counted false kick — the tuning evidence (a floor
  // is only raised into a MEASURED gap, never guessed)
  const amps = [];
  let prev = signals[0]?.swim?.count ?? 0;
  for (const s of signals) {
    const c = s.swim?.count ?? prev;
    if (c > prev) amps.push(s.swim.amp);
    prev = Math.max(prev, c);
  }
  return {
    swimFalsePositives: {
      pass: kicks <= maxKicks,
      detail: `${kicks} swim kicks (amps: ${amps.map((a) => a.toFixed(3)).join(', ') || '—'}), ${activeFrames} rhythm-active frames on non-swim footage (≤${maxKicks})${note}`,
      kicks,
      amps,
    },
  };
}

// --- stats helpers --------------------------------------------------------
const pctl = (vals, q) => {
  if (!vals.length) return 0;
  const a = [...vals].sort((x, y) => x - y);
  return a[Math.min(a.length - 1, Math.floor(a.length * q))];
};

/** Sustained runs where pred holds, merging gaps < 400 ms (depth noise at
 *  extreme poses flickers the signal; the gap tolerance is an analysis
 *  parameter, set from the fixture data, not a product threshold). */
function episodes(signals, pred, minMs) {
  const runs = [];
  let start = null;
  let lastTrue = null;
  for (const s of signals) {
    if (pred(s)) {
      if (start === null) start = s.ts;
      lastTrue = s.ts;
    } else if (start !== null && s.ts - lastTrue > 400) {
      runs.push({ start, end: lastTrue });
      start = null;
    }
  }
  if (start !== null) runs.push({ start, end: lastTrue });
  return runs.filter((r) => r.end - r.start >= minMs);
}

function inEpisodes(runs, ts) {
  return runs.some((r) => ts >= r.start && ts <= r.end);
}

function events(signals, name) {
  return signals.filter((s) => s.events.includes(name)).length;
}

// --- per-fixture assertions -----------------------------------------------
// "signed windows" = at least one sustained episode per direction plus a
// floor on total signed time — episode COUNTS flap when a lean spans the
// clip's loop boundary, so they are reported but not asserted.
function bipolarChecks(signals, axis, quietAxis, mag = 0.45) {
  const pos = episodes(signals, (s) => s.axes[axis] > mag, 800);
  const neg = episodes(signals, (s) => s.axes[axis] < -mag, 800);
  const frameMs = 1000 / 30;
  const posMs = signals.filter((s) => s.axes[axis] > mag).length * frameMs;
  const negMs = signals.filter((s) => s.axes[axis] < -mag).length * frameMs;
  const all = [...pos, ...neg];
  const quietVals = signals.filter((s) => inEpisodes(all, s.ts)).map((s) => Math.abs(s.axes[quietAxis]));
  const returns = signals.some(
    (s) => !inEpisodes(all, s.ts) && Math.abs(s.axes[axis]) < 0.15 && s.ts > (all[0]?.end ?? 0),
  );
  return {
    [`${axis}+windows`]: {
      pass: pos.length >= 1 && posMs >= 2000,
      detail: `${pos.length} sustained, ${(posMs / 1000).toFixed(1)}s > +${mag} (need ≥1 ep, ≥2 s)`,
    },
    [`${axis}-windows`]: {
      pass: neg.length >= 1 && negMs >= 2000,
      detail: `${neg.length} sustained, ${(negMs / 1000).toFixed(1)}s < -${mag} (need ≥1 ep, ≥2 s)`,
    },
    // recorded, not asserted: hard leans carry systematic MediaPipe depth
    // error into the off axis (0.5–0.66 p95 across runs for leanY). A
    // pass/fail line here would just be threshold-chasing; the number is
    // published as a measured limitation (README, EVAL_NOTES).
    crossAxisBleed: {
      pass: true,
      detail: `${quietAxis} p95=${pctl(quietVals, 0.95).toFixed(3)} during episodes (recorded metric)`,
    },
    returnsToDeadZone: { pass: returns, detail: `re-centers below 0.15 between episodes: ${returns}` },
  };
}

/** Rowing: stroke count vs hand-labeled truth, rhythm coverage, rate
 *  readability; left-bias and seated variants add their own lines. */
function rowingChecks(signals, truth, opts = {}) {
  // Strokes are counted inside the clip's labeled ROWING WINDOW (video
  // seconds, from the recording protocol / wrist trace): boundary motions
  // — reaching to start/stop the recording — are real fore-aft excursions
  // the detector honestly reports, but they are not pulls and the hand
  // label does not include them (left_bias: 15 pulls finish 6.4–44.1 s,
  // stop-reach at ~46.8 s reads amp 0.9 on BOTH arms).
  const [w0, w1] = opts.windowS ?? [-Infinity, Infinity];
  const videoT = (sig) => (opts.playAt != null ? (sig.ts - opts.playAt) / 1000 : 0);
  const strokeTimes = [];
  let prevCount = signals[0]?.stroke?.count ?? 0;
  for (const sig of signals) {
    const c = sig.stroke?.count ?? prevCount;
    if (c > prevCount) {
      const t = videoT(sig);
      if (opts.windowS == null || (t >= w0 && t <= w1)) {
        for (let k = prevCount; k < c; k++) strokeTimes.push(t);
      }
    }
    prevCount = Math.max(prevCount, c);
  }
  const detected = strokeTimes.length;
  if (opts.playAt != null) {
    console.log(`  stroke finishes (video s): ${strokeTimes.map((t) => t.toFixed(1)).join(' ')}`);
  }
  const active = signals.filter((s) => s.stroke?.active);
  const rateP50 = pctl(active.map((s) => s.stroke.rate), 0.5);
  const out = {
    strokeCount: {
      pass: Math.abs(detected - truth) <= 1,
      detail: `${detected} strokes in window (hand-labeled truth ${truth}, ±1)${opts.labelNote ?? ''}`,
      detected,
    },
    rhythmActive: {
      pass: active.length > signals.length * 0.3,
      detail: `rhythm active ${((100 * active.length) / Math.max(signals.length, 1)).toFixed(1)}% of frames (≥30%)`,
    },
    rateRead: {
      pass: rateP50 > 0.15,
      detail: `rate p50=${rateP50.toFixed(3)} Hz over active frames (>0.15)`,
      rateP50,
    },
  };
  if (opts.leftBias) {
    const d50 = pctl(active.map((s) => s.stroke.ampL - s.stroke.ampR), 0.5);
    out.leftBiasSign = {
      pass: d50 > 0.05,
      detail: `ampL−ampR p50=${d50.toFixed(3)} during rhythm (>0.05 — left arm dominant)`,
    };
  }
  if (opts.seated) {
    const frac = signals.filter((s) => s.seated).length / Math.max(signals.length, 1);
    out.seatedFlag = {
      pass: true,
      detail: `seated flag ${(frac * 100).toFixed(1)}% of frames (recorded metric — count is the assertion)`,
    };
  }
  // recorded, not asserted: rowing's torso rock is genuinely rhythmic and
  // may modulate chest–hip extent; rowing clips never feed the dolphin —
  // the number is published so the overlap is known, not hidden
  const kicks = (signals[signals.length - 1]?.swim?.count ?? 0) - (signals[0]?.swim?.count ?? 0);
  out.swimOverlap = {
    pass: true,
    detail: `${kicks} swim kicks during rowing (recorded metric — clips never feed the dolphin)`,
  };
  return out;
}

const CHECKS = {
  // gait ≤1 on lean_lr: THE load-bearing walking negative — alternating
  // lateral leans are the closest natural motion to weight-shift sway;
  // the maxStepMs gate (1600 ms) is what keeps slow lean alternations
  // from ever forming a rhythm.
  lean_lr: (s) => ({
    ...bipolarChecks(s, 'leanX', 'leanY'), ...swimNegative(s, 1),
    ...gaitNegative(s, 1, ' — alternating lateral leans must not walk'),
  }),
  // 0.35 for leanY: signed-window detection at 3.5× its measured noise
  // floor — the depth axis is not magnitude-repeatable enough for 0.45
  // (episode counts flapped run-to-run purely on neutral/loop phase)
  // swim ≤2: a sustained lean is one extent reversal — but HARD alternating
  // full-deflection leans occasionally pair two excursions at the amp floor
  // (measured 0–2 across runs post tilt-correction, always 0 rhythm-active
  // frames; in-game effect = one small surge while already pitch-diving).
  // The bound is the measured variance ceiling, not a wish; tightening the
  // floor further without a positive torso-wave fixture risks deafness.
  lean_fb: (s) => ({
    ...bipolarChecks(s, 'leanY', 'leanX', 0.35),
    ...swimNegative(s, 2, ' — hard alternating leans; isolated pairs, never a rhythm'),
    ...gaitNegative(s, 1, ' — fore-aft leans; no lateral alternation'),
  }),
  crouch_stand: (signals) => {
    const runs = episodes(signals, (s) => s.axes.crouch > 0.45, 800);
    const totalMs = signals.filter((s) => s.axes.crouch > 0.45).length * (1000 / 30);
    const returns = signals.some(
      (s) => !inEpisodes(runs, s.ts) && s.axes.crouch < 0.15 && s.ts > (runs[0]?.end ?? Infinity),
    );
    return {
      crouchWindows: {
        pass: runs.length >= 1 && totalMs >= 2000,
        detail: `${runs.length} sustained, ${(totalMs / 1000).toFixed(1)}s > 0.45 (need ≥1 ep, ≥2 s)`,
      },
      standsBackUp: { pass: returns, detail: `returns below 0.15 between crouches: ${returns}` },
      // crouch cycles drop chest AND hips together (in-phase) — the
      // anti-phase extent signal must not read them as dolphin kicks
      ...swimNegative(signals, 2, ' — crouch/stand cycles, in-phase'),
      // both knees bend TOGETHER in a crouch — the knee-lift DIFFERENCE
      // must stay quiet
      ...gaitNegative(signals, 2, ' — symmetric crouch cycles; kneeDiff quiet'),
    };
  },
  arms_tpose: (signals) => {
    const runs = episodes(signals, (s) => s.axes.armsOut > 0.75, 800);
    const recenters = events(signals, 'recenter');
    const actions = events(signals, 'action');
    return {
      tposeEpisodes: { pass: runs.length >= 1, detail: `${runs.length} sustained armsOut > 0.75` },
      recenterFires: { pass: recenters >= 1, detail: `${recenters} recenter events (need ≥1)` },
      // recorded, not asserted: the clip contains genuine fast forward-arm
      // reaches, and a thrust detector firing on a real thrust-shaped input
      // is correct. still.mp4's zero-events check is the false-positive bar.
      actionEvents: { pass: true, detail: `${actions} action events (recorded metric)` },
    };
  },
  seated: (signals) => {
    const after = signals.filter((s) => s.ts - signals[0].ts > 5000);
    const frac = after.filter((s) => s.seated).length / Math.max(after.length, 1);
    let flips = 0;
    for (let i = 1; i < signals.length; i++) if (signals[i].seated !== signals[i - 1].seated) flips++;
    return {
      seatedDetected: { pass: frac >= 0.8, detail: `seated ${(frac * 100).toFixed(1)}% after 5 s (≥80%)` },
      noFlapping: { pass: flips <= 2, detail: `${flips} flips (≤2)` },
      // sitting down / sitting still is not walking
      ...gaitNegative(signals, 1, ' — sit-down transition; no gait rhythm'),
    };
  },
  still: (signals) => {
    const evTotal = signals.filter((s) => s.events.length > 0).length;
    const stillP50 = pctl(signals.map((s) => s.stillness), 0.5);
    const floors = {};
    let worst = 0;
    for (const a of AXES) {
      floors[a] = pctl(signals.map((s) => Math.abs(s.axes[a])), 0.99);
      worst = Math.max(worst, floors[a]);
    }
    const strokes = (signals[signals.length - 1]?.stroke?.count ?? 0) - (signals[0]?.stroke?.count ?? 0);
    const activeFrames = signals.filter((s) => s.stroke?.active).length;
    const kicks = (signals[signals.length - 1]?.swim?.count ?? 0) - (signals[0]?.swim?.count ?? 0);
    const swimActive = signals.filter((s) => s.swim?.active).length;
    const swimAmpP99 = pctl(signals.map((s) => s.swim?.amp ?? 0), 0.99);
    return {
      noEvents: { pass: evTotal === 0, detail: `${evTotal} event frames (need 0)` },
      stillnessHigh: { pass: stillP50 >= 0.75, detail: `stillness p50=${stillP50.toFixed(3)} (≥0.75)` },
      shapedNoiseFloor: {
        pass: worst <= 0.08,
        detail: `worst shaped p99=${worst.toFixed(4)} (≤0.08)`,
        floors,
      },
      strokesZero: {
        pass: strokes === 0 && activeFrames === 0,
        detail: `${strokes} strokes, ${activeFrames} rhythm-active frames on still footage (need 0/0)`,
      },
      swimZero: {
        pass: kicks === 0 && swimActive === 0,
        detail: `${kicks} swim kicks, ${swimActive} rhythm-active frames on still footage (need 0/0); extent-excursion amp p99=${swimAmpP99.toFixed(4)} (measured floor)`,
        swimAmpP99,
      },
      gaitZero: (() => {
        const steps = (signals[signals.length - 1]?.gait?.count ?? 0) - (signals[0]?.gait?.count ?? 0);
        const gaitActive = signals.filter((s) => s.gait?.active).length;
        const shiftP99 = pctl(signals.map((s) => Math.abs(s.gait?.shift ?? 0)), 0.99);
        return {
          pass: steps === 0 && gaitActive === 0,
          detail: `${steps} gait steps, ${gaitActive} rhythm-active frames on still footage (need 0/0); |shift| p99=${shiftP99.toFixed(4)} (measured floor)`,
          shiftP99,
        };
      })(),
    };
  },
  rowing_slow: (s, playAt) => rowingChecks(s, STROKE_TRUTH.rowing_slow, { playAt }),
  rowing_fast: (s, playAt) => rowingChecks(s, STROKE_TRUTH.rowing_fast, { playAt }),
  rowing_left_bias: (s, playAt) =>
    rowingChecks(s, STROKE_TRUTH.rowing_left_bias, {
      leftBias: true,
      playAt,
      // rowing segment from the wrist trace: pulls finish 6.4–44.1 s; the
      // stop-recording reach (~46.8 s, symmetric amp ~0.9) is not a pull
      windowS: [4, 45.5],
    }),
  rowing_seated: (s, playAt) =>
    rowingChecks(s, STROKE_TRUTH.rowing_seated, {
      seated: true,
      playAt,
      labelNote: ' — measured label (prescribed 15; see STROKE_TRUTH note), confirm at Gate 2',
    }),
  // chest-up crop of rowing_seated (same pulls): the Gate-2 round-2 live
  // framing — propulsion must never depend on leg visibility
  rowing_seated_upper: (s, playAt) =>
    rowingChecks(s, STROKE_TRUTH.rowing_seated_upper, { seated: true, playAt }),
};

// --- rig -------------------------------------------------------------------
async function serverUp() {
  try {
    await fetch(BASE);
    return true;
  } catch {
    return false;
  }
}
let devServer = null;
if (!(await serverUp())) {
  console.log('starting dev server…');
  devServer = spawn('npm', ['run', 'dev', '--', '--port', PP_PORT, '--strictPort'], {
    cwd: root, stdio: 'ignore', detached: true,
  });
  for (let i = 0; i < 60 && !(await serverUp()); i++) await new Promise((r) => setTimeout(r, 500));
}

const results = { generatedAt: new Date().toISOString(), headless, fixtures: {}, allPass: true };

for (const fixture of fixtures) {
  // Rowing fixtures run in single-pass VIDEO-FILE mode (?video=), not the
  // looping fake webcam: the count-vs-truth check needs exactly one pass —
  // the clips start/end mid-motion, so a y4m loop seam swallows or
  // fabricates a stroke every crossing (measured 2026-07-08: ±1–3 per run).
  // crouch_stand is single-pass too: a looping fake camera captures the
  // neutral at an ARBITRARY loop phase — a mid-crouch neutral zeroes the
  // whole axis (measured 2026-07-11: 0 sustained windows on the rebuilt
  // remote, while a single pass from t=0 reads crouch 0.9). Episodic
  // stature claims need the clip's opening standing segment as neutral.
  const isRowing = fixture.startsWith('rowing_');
  const singlePass = isRowing || fixture === 'crouch_stand';
  const fixtureDir = isRowing ? 'rowing' : 'flight';
  const src = singlePass
    ? resolve(root, 'fixtures', fixtureDir, `${fixture}.mp4`)
    : resolve(root, 'fixtures', 'flight', `${fixture}.y4m`);
  if (!existsSync(src)) {
    console.error(`missing ${src}${singlePass ? '' : ' — npm run prepare-fixtures'}`);
    process.exit(1);
  }
  const dur = DURATIONS[fixture] ?? 30;
  console.log(`\n=== ${fixture} (${dur}s) ===`);
  const browser = await chromium.launch({
    headless,
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      ...(singlePass ? [] : [`--use-file-for-fake-video-capture=${src}`]),
      '--autoplay-policy=no-user-gesture-required',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-background-timer-throttling',
    ],
  });
  try {
    const page = await browser.newPage();
    const modelQ = liteModel ? '&model=lite' : '';
    const query = singlePass
      ? `?avatar=robot&video=/fixtures/${fixtureDir}/${fixture}.mp4${modelQ}`
      : `?avatar=robot${modelQ}`;
    await page.goto(`${BASE}/${query}`);
    await page.waitForFunction(
      () => window.__BI?.core.getNeutral() !== null && window.__PP?.detectionCount > 10,
      undefined,
      { timeout: 60_000 },
    );
    const collected = singlePass
      ? await page.evaluate(
          ({ timeoutS, resetCore }) =>
            new Promise((res) => {
              // Single pass: pause, rewind, park > maxPeriodMs so the
              // detector's drive-duration gate discards any pre-seek catch,
              // then play once and stop at the clip's end (or wrap).
              const video = document.getElementById('video');
              video.pause();
              video.currentTime = 0;
              // Fresh core for EPISODIC STATURE fixtures only: their
              // neutral must come from the clip's standing pre-roll (a
              // looping-phase mid-crouch neutral zeroes the crouch axis —
              // measured). The rowing fixtures keep the page's neutral:
              // resetting them onto a frame-0 MID-STROKE park shifted the
              // arm-length normalization and cost 2 of 13 seated strokes
              // (measured), and stroke detection never needed the reset.
              if (resetCore) window.__BI.core.reset();
              setTimeout(() => {
                const sigs = [];
                const lats = [];
                const unsub = window.__BI.source.subscribe((s) => {
                  sigs.push(s);
                  lats.push(performance.now() - s.ts);
                });
                let prevT = 0;
                const t0 = performance.now();
                const poll = setInterval(() => {
                  const t = video.currentTime;
                  const done =
                    t < prevT - 0.5 || // looped
                    t >= video.duration - 0.05 ||
                    performance.now() - t0 > timeoutS * 1000;
                  prevT = Math.max(prevT, t);
                  if (done) {
                    clearInterval(poll);
                    unsub();
                    res({ sigs, lats, passSeconds: prevT, playAt: window.__playAt });
                  }
                }, 50);
                window.__playAt = performance.now();
                void video.play();
              }, 4600);
            }),
          { timeoutS: dur, resetCore: fixture === 'crouch_stand' },
        )
      : await page.evaluate(
          (seconds) =>
            new Promise((res) => {
              const sigs = [];
              const lats = [];
              const unsub = window.__BI.source.subscribe((s) => {
                sigs.push(s);
                lats.push(performance.now() - s.ts);
              });
              setTimeout(() => {
                unsub();
                res({ sigs, lats, passSeconds: seconds });
              }, seconds * 1000);
            }),
          dur,
        );
    const { sigs, lats, passSeconds } = collected;
    console.log(`${sigs.length} signals (${(sigs.length / passSeconds).toFixed(1)} Hz over ${passSeconds.toFixed(1)}s)`);

    // transparency: percentile profile of the axes this clip exercises
    const PROFILE = {
      lean_lr: ['leanX', 'leanY'], lean_fb: ['leanY', 'leanX'],
      crouch_stand: ['crouch', 'tallness'], arms_tpose: ['armsOut', 'armsRaised', 'handsForward'],
      seated: ['crouch'], still: [],
      rowing_slow: ['handsForward'], rowing_fast: ['handsForward'],
      rowing_left_bias: ['handsForward'], rowing_seated: ['handsForward'],
    };
    for (const a of PROFILE[fixture] ?? []) {
      const vals = sigs.map((s) => s.axes[a]);
      console.log(
        `  ${a.padEnd(13)} p05=${pctl(vals, 0.05).toFixed(2)} p25=${pctl(vals, 0.25).toFixed(2)} ` +
          `p50=${pctl(vals, 0.5).toFixed(2)} p75=${pctl(vals, 0.75).toFixed(2)} p95=${pctl(vals, 0.95).toFixed(2)}`,
      );
    }
    if (fixture === 'crouch_stand' || fixture === 'seated') {
      const frac = sigs.filter((s) => s.seated).length / sigs.length;
      console.log(`  seated flag: ${(frac * 100).toFixed(1)}% of frames`);
    }
    if (fixture.startsWith('rowing_')) {
      const active = sigs.filter((s) => s.stroke?.active);
      const rates = active.map((s) => s.stroke.rate);
      console.log(
        `  stroke: count ${(sigs[sigs.length - 1]?.stroke?.count ?? 0) - (sigs[0]?.stroke?.count ?? 0)}, ` +
          `rate p25=${pctl(rates, 0.25).toFixed(2)} p50=${pctl(rates, 0.5).toFixed(2)} ` +
          `p75=${pctl(rates, 0.75).toFixed(2)} Hz, ` +
          `ampL p50=${pctl(active.map((s) => s.stroke.ampL), 0.5).toFixed(2)} ` +
          `ampR p50=${pctl(active.map((s) => s.stroke.ampR), 0.5).toFixed(2)}`,
      );
    }

    const checks = CHECKS[fixture] ? CHECKS[fixture](sigs, collected.playAt) : {};
    // universal checks
    let shapeErr = null;
    for (const s of sigs) {
      shapeErr = checkShape(s);
      if (shapeErr) break;
    }
    checks.schemaShape = { pass: shapeErr === null, detail: shapeErr ?? 'every signal schema-clean' };
    const confP50 = pctl(sigs.map((s) => s.confidence), 0.5);
    checks.confident = { pass: confP50 >= 0.6, detail: `confidence p50=${confP50.toFixed(3)} (≥0.6)` };

    const fixtureResult = {
      signals: sigs.length,
      hz: Number((sigs.length / passSeconds).toFixed(2)),
      latencyMsP50: Number(pctl(lats, 0.5).toFixed(1)),
      latencyMsP95: Number(pctl(lats, 0.95).toFixed(1)),
      checks,
    };
    for (const [name, c] of Object.entries(checks)) {
      console.log(`  ${c.pass ? '✓' : '✗'} ${name}: ${c.detail}`);
      if (!c.pass) results.allPass = false;
    }
    console.log(`  latency p50=${fixtureResult.latencyMsP50}ms p95=${fixtureResult.latencyMsP95}ms`);
    results.fixtures[fixture] = fixtureResult;
  } finally {
    await browser.close();
  }
}

// cross-clip: the read rate must track the performed cadence (slow < fast).
// Only meaningful when both rowing clips ran in this invocation.
const slowRate = results.fixtures.rowing_slow?.checks?.rateRead?.rateP50;
const fastRate = results.fixtures.rowing_fast?.checks?.rateRead?.rateP50;
if (slowRate !== undefined && fastRate !== undefined) {
  const pass = fastRate > slowRate * 1.3;
  results.fixtures.rowing_fast.checks.rateOrdering = {
    pass,
    detail: `rate p50 fast=${fastRate.toFixed(3)} Hz vs slow=${slowRate.toFixed(3)} Hz (fast > 1.3× slow)`,
  };
  console.log(`\n  ${pass ? '✓' : '✗'} rateOrdering: ${results.fixtures.rowing_fast.checks.rateOrdering.detail}`);
  if (!pass) results.allPass = false;
}

const out = resolve(root, 'eval', 'bodyinput-results.json');
writeFileSync(out, JSON.stringify(results, null, 2) + '\n');
console.log(`\n${results.allPass ? 'ALL GREEN' : 'FAILURES PRESENT'} → ${out}`);
if (devServer) process.kill(-devServer.pid, 'SIGTERM');
process.exit(results.allPass ? 0 : 1);
