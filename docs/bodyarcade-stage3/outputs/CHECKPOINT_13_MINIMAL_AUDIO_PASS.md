# CHECKPOINT 13 — Minimal Audio Pass

## 1. Header

Checkpoint 13: the five-sound slice — above-water ambient loop, underwater ambient loop, breach splash, surface breathing, and the waterline low-pass muffle transition — via plain WebAudio / `THREE.PositionalAudio`. Sources per the Track C mini-manifest; the runtime never generates audio; FMOD/Wwise are not used.

## 2. Preconditions and starting state

- Checkpoint 12 approved (or approved-with-standing-blocks). Branch `shared-world-slice` at the 12-approved commit; tree clean.
- **User actions checked first:** (a) the Sonniss #GameAudioGDC bundle is a user download — confirm it is locally available and which files the user pulled for the above-water bed / splash / breath; (b) ElevenLabs generation is only used if the user has authorized a paid plan (Starter+ carries the commercial license). If neither Sonniss files nor ElevenLabs authorization exist, ship the CC0 fallbacks (Freesound/OGA) for every slot and record the substitution.

## 3. In scope

1. Asset intake to `apps/shared-world/public/audio/biomes/reef/` (other biome dirs as empty stubs): `sfx_amb_underwater_reef_01.ogg` (★ Freesound #366159 "Underwater [Loop] AMB" by DCSFX, CC0 — verify the file's license box live), `sfx_amb_surface_reef_01.ogg` (Sonniss pick or klankbeeld/OGA CC0 fallback — per-file license check), `sfx_splash_breach_01.ogg` (+ `_02` variant if available), `sfx_breath_surface_01.ogg` (+ variant). Loudness-normalize loops (−18 LUFS integrated [DERIVED, flagged]) and trim seamless loop points; convert to OGG.
2. Runtime wiring: one `THREE.AudioListener` on the camera; ambient beds as global (non-positional) loops crossfaded by the listener's above/below state; breach splash as a one-shot `PositionalAudio` at the crossing point (exit and entry, entry louder ×1.3 [DERIVED, flagged]); breath one-shot when `BreatheSurface` engages.
3. The waterline muffle: a `BiquadFilterNode` low-pass in the master chain — above water: open (20 kHz); below: 800 Hz cutoff [DERIVED starting value, flagged]; the cutoff and bed crossfade sweep over 0.25 s at the crossing [DERIVED, flagged], driven by the same surface-crossing signal the camera uses.
4. Volume settings: master + sfx/ambient sliders in a minimal dev settings row (`&audio=0` mutes for tests); default master 0.7 [DERIVED, flagged].
5. CREDITS.md audio section + compliance notes (Sonniss: no resale as-is, no AI/ML-training use; Freesound per-file licenses).
6. Commit.

## 4. Out of scope

- No biome-bed system beyond reef (stubs only); no creature vocalizations; no music; no sonar audio; no ElevenLabs generation without explicit paid-plan authorization; no runtime synthesis.
- No audio-reactive visuals.

## 5. Required inputs

- Implementation Master §8.4; master context §14 (slice scope; runtime-never-generates law).
- Track C report §7 (mini-manifest tables 7a/7b, license notes), §9 (obligation ledger).
- User-supplied Sonniss files (if any); Freesound/OGA fallback URLs from Track C 7a.
- The breach chain (cp06) and surface-crossing signal (cp02) as event sources.

## 6. Deterministic implementation specification

- Event mapping: `Crossing` (upward) → exit splash at the crossing position; `ReEntry` → entry splash ×1.3; `BreatheSurface` animation engage → breath one-shot (min 4 s between breaths [DERIVED, flagged]); bed crossfade + filter sweep keyed to the camera's y-0 crossing (not the dolphin's — the listener is the camera).
- PositionalAudio settings: refDistance 5 m, rolloff linear, maxDistance 60 m [DERIVED, flagged].
- All audio decoded once at load; no network fetches after load; `&audio=0` disables the graph cleanly.
- File hygiene: OGG Vorbis q5; loop files verified click-free at the seam (report the loop points).

## 7. Demo

```bash
npm --prefix apps/shared-world run dev
# → http://localhost:5198/shared-world/?view=region
```

Expected (headphones): underwater is a muffled colored bed; surfacing sweeps the filter open into air ambience; a breach gives whoosh-splash out and heavier splash in; lingering at the surface breathes; diving re-muffles. Nothing loops audibly; nothing clips.

## 8. Automated verification

1. Wiring: scripted breach → exactly 2 splash events (exit/entry) + filter sweep observed (instrument the audio graph); scripted surface linger → breath fired with the 4 s spacing.
2. State correctness: listener above y 0 → surface bed dominant + filter open; below → underwater bed + 800 Hz cutoff (assert node params).
3. License audit: every file in `public/audio/**` maps to a CREDITS.md entry with license note (orphan check fails).
4. No-network guard: the privacy/no-fetch expectation — zero network requests after load attributable to audio.
5. Mute path: `&audio=0` → no AudioContext errors, suites unaffected.
6. Four-shot re-run unchanged; all suites green; `simHz > 100`; sustained median `fps ≥ 58` (audio CPU ≤ 0.3 ms/frame).

## 9. Manual review procedure

1. Full loop with headphones: bed feel per zone depth, crossing sweep naturalness, splash weight vs breach vigor, breath timing; loudness comfort at default 0.7.
2. Rule on flagged values (cutoff 800 Hz, sweep 0.25 s, LUFS, positional ranges).
3. If fallbacks were used for Sonniss slots: approve them as shipping choices or supply Sonniss picks for a re-run.

## 10. Performance-report requirements

Audio CPU cost, decode memory, load-time delta, fps unchanged proof.

## 11. Placeholder inventory requirements

Census unchanged (audio converts the audio-emitter dev markers to live emitters — record that conversion); remaining visual placeholders restated.

## 12. Deviation-report requirements

Which slot used which source (★ vs fallback) and why; all [DERIVED] audio values; any loop that needed editing (what was done).

## 13. Guardrails

- Runtime never generates audio; no middleware; sources license-verified per file before commit; Sonniss compliance notes recorded; ElevenLabs only with explicit paid-plan authorization; purchase nothing yourself.
- No visual changes of any kind (four-shot proves); approved visuals immutable.
- Local-only; no post-load network; tests never weakened.

## 14. Stop

Produce the end-of-checkpoint report (changes, source/license table, wiring evidence, performance, deviations), commit, then:

STOP — wait for user review and approval before any further visual change. Approval of this checkpoint does not authorize starting the next checkpoint.
