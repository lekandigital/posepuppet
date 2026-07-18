# CHECKPOINT 13 — Audio

## Header

**Checkpoint:** 13 — Audio
**Prerequisite:** Checkpoint 12 approved. Structures in place.
**Base state:** Full region with water, terrain, caves, atmosphere, vegetation, fish, structures.

---

## Scope

**Build a minimal audio pass** — ambient loops, event sounds, and the waterline muffle transition.

1. **Audio system:** plain `WebAudio` API via `THREE.AudioListener` + `THREE.Audio` (global) and `THREE.PositionalAudio` (spatial). No FMOD, no Wwise, no audio middleware. (Master context §14)

2. **Ambient loops:**

   | Sound | Source | License | Behavior |
   |---|---|---|---|
   | Underwater ambient | "Underwater [Loop] AMB" by DCSFX (Freesound) | CC0 | Loop always when camera below surface |
   | Above-water ambient | TBD — ocean/wind loop from Freesound CC0 | CC0 | Loop always when camera above surface |

   Crossfade between underwater and above-water ambient over 0.3–0.5 s at the waterline.

3. **Event sounds:**

   | Event | Sound source | License | Trigger |
   |---|---|---|---|
   | Breach splash | Sonniss #GameAudioGDC bundle | Royalty-free | On breach Crossing state |
   | Re-entry splash | Same source, different take | Royalty-free | On ReEntry state |
   | Surface breathing | Same Sonniss source or Freesound CC0 | — | On BreatheSurface animation play |

4. **Low-pass muffle at the waterline** (master context §14):
   - When camera is underwater: apply a `BiquadFilterNode` low-pass at ~800 Hz to above-water sounds (muffles external sounds).
   - When camera is above water: apply low-pass to underwater ambient (muffles underwater sounds heard from above).
   - At the waterline: blend filter frequency over 0.3 s.

5. **Spatial audio for events:**
   - Splash sounds: `PositionalAudio` at the splash position.
   - Ambient loops: global `Audio` (non-spatial).

6. **Volume controls:**
   - Master volume.
   - Ambient volume (separate).
   - Event/SFX volume (separate).
   - Default all to 0.7 (not max — leave headroom for body-input audio cues later).

**Out of scope:**
- Music / soundtrack (future).
- Sonar sounds (out of slice — master context §11.1).
- Dialogue / narration.
- Complex reverb / cave echo (stretch goal — not in this checkpoint).
- ElevenLabs or any generative audio.

---

## Inputs

| Input | Section | Purpose |
|---|---|---|
| Implementation Master | §8.5 (Audio Slice Set) | Sound sources, licenses |
| `TRACK_C_ASSETS_AUDIO_DOLPHIN_REPORT.md` | §7 | Audio mini-manifest |
| Master context §14 | — | Audio strategy |

---

## Specification

### Audio initialization

```typescript
const listener = new THREE.AudioListener();
camera.add(listener);

// Global ambient
const underwaterAmbient = new THREE.Audio(listener);
const aboveWaterAmbient = new THREE.Audio(listener);

// Load sounds
const audioLoader = new THREE.AudioLoader();
const underwaterBuffer = await audioLoader.loadAsync('/shared-world/audio/underwater_ambient.ogg');
underwaterAmbient.setBuffer(underwaterBuffer);
underwaterAmbient.setLoop(true);
underwaterAmbient.setVolume(0.7);
```

### Low-pass muffle implementation

```typescript
const audioContext = listener.context;
const lowPassFilter = audioContext.createBiquadFilter();
lowPassFilter.type = 'lowpass';
lowPassFilter.frequency.value = 22050; // start unfiltered

// When underwater:
lowPassFilter.frequency.linearRampToValueAtTime(800, audioContext.currentTime + 0.3);
// When above water:
lowPassFilter.frequency.linearRampToValueAtTime(22050, audioContext.currentTime + 0.3);

// Route above-water sounds through the filter when underwater
aboveWaterAmbient.setFilters([lowPassFilter]);
```

### Ambient crossfade at waterline

```typescript
function updateAmbientCrossfade(cameraY: number) {
  const blend = smoothstep(-0.5, 0.5, cameraY); // 0 = fully underwater, 1 = fully above
  underwaterAmbient.setVolume((1 - blend) * masterVolume * ambientVolume);
  aboveWaterAmbient.setVolume(blend * masterVolume * ambientVolume);
}
```

### Audio file paths

```
apps/shared-world/public/audio/
├── underwater_ambient.ogg     ← CC0
├── above_water_ambient.ogg    ← CC0
├── breach_splash.ogg          ← Sonniss royalty-free
├── reentry_splash.ogg         ← Sonniss royalty-free
└── surface_breath.ogg         ← CC0 / Sonniss
```

All audio files: OGG Vorbis format, 44.1 kHz, mono (spatial) or stereo (ambient). Keep file sizes small (<1 MB each).

---

## Demo

```bash
npm --prefix apps/shared-world run dev
```

**What the user should see and hear:**
- Underwater: a continuous underwater ambient loop — bubbling, deep, atmospheric.
- Surface: transition to above-water ambient — ocean, wind, air.
- At the waterline: crossfade between the two ambient layers.
- Breach: splash sound on exit and re-entry.
- Surface breathing: breathing sound when the BreatheSurface animation plays.
- From underwater: above-water sounds are muffled (low-pass filter).

**What the user should try:**
- Swim normally underwater — ambient loop should be continuous and not annoying.
- Surface — hear the crossfade to above-water sounds.
- Dive back down — hear the crossfade back, above-water sounds muffle.
- Breach — hear the splash on exit and re-entry.
- Swim for 5+ minutes — audio should enhance, not fatigue.

---

## Verification

### Automated
- Audio context initializes without errors.
- Ambient loops play continuously without gaps.
- No audio errors in console.
- fps ≥ 60 (audio should have negligible performance cost).

### Manual review
- Underwater ambient is atmospheric, not annoying.
- Above-water ambient is natural.
- Crossfade at waterline is smooth (no click, no gap).
- Low-pass muffle is perceptible but not harsh.
- Splash sounds sync with breach visual events.
- Volume levels are comfortable at defaults.

---

## Stop

**STOP.** Report:
1. Audio files used (name, source, license, format, size).
2. Low-pass filter parameters.
3. Crossfade implementation and timing.
4. Event sound trigger mapping (which state → which sound).
5. Volume defaults.
6. CREDITS.md updated with audio attributions.
7. Performance: fps unchanged (audio is negligible cost).
8. Deviations from this specification.

**Wait for user review and approval. Approval of checkpoint 13 does not authorize starting checkpoint 14.**

---

## Guardrails

- No purchased audio. CC0 and royalty-free only.
- No FMOD, Wwise, or audio middleware — plain WebAudio.
- No music/soundtrack (future phase).
- No sonar sounds (out of slice).
- Approved visuals immutable (audio-only checkpoint).
- Local-only.
- Credits updated for all audio sources.
