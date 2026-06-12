# PosePuppet — Pass-2 Design Plan (for USER GATE 2)

Translation of `design/reference.css`'s grammar into a glass-cockpit
instrument around a live stage. Grammar kept: tokenized theme, 1px rule
structure, shared-border grids, three type roles, mono status language,
translucent sticky chrome with hard borders, unmistakable active states,
grain + vignette, restrained motion, light/dark. Palette deliberately NOT
kept (palette law: no beige/brown/warm paper anywhere).

## 1. Tokens (named values)

Dark is the demo default. Light ships equal.

| token | dark | light | role |
|---|---|---|---|
| `--base` | `#07090f` | `#eef2f8` | page bed (graphite-black / pale glass) |
| `--pane` | `#0d1119` | `#f7fafd` | panel fill |
| `--pane-2` | `#131826` | `#e7edf6` | raised/hover fill |
| `--glass` | `rgba(13,17,25,.72)` | `rgba(247,250,253,.78)` | translucent chrome (blur on static chrome only) |
| `--ink` | `#e9f1ff` | `#0b1018` | primary text (pale glass white / graphite) |
| `--ink-2` | `#aebdd6` | `#2c3648` | secondary text |
| `--ink-3` | `#66748f` | `#5a6880` | mono labels at rest |
| `--rule` | `#1d2536` | `#c5d0e0` | hairlines |
| `--rule-2` | `#2a3650` | `#a9b8cd` | emphasized hairlines |
| `--blue` | `#2f6bff` | `#1f56e0` | electric blue — primary accent, record-armed, active states |
| `--cyan` | `#3fe0ff` | `#0096b8` | live-signal highlights (tracking, FPS ok, LIVE) |
| `--violet` | `#9d7bff` | `#6d3fd6` | secondary glow — ghost/memory features own this hue |
| `--glow` | `#c8ffdf` | `#0f8a52` | pale green-white — the privacy receipt's "all clear" |
| `--warn` | `#ffb454` | `#9a5b00` | coach attention (sparingly) |
| `--danger` | `#ff4d6a` | `#c41f3e` | recording dot, destructive |
| `--grain-1/2` | cool-white rgba ~3% | graphite rgba ~4% | dot-matrix grain, `screen`/`multiply` |
| `--vignette` | `rgba(2,4,10,.6)` | `rgba(20,30,50,.10)` | ellipse at 50% 20% |

Glow is an effect, not just a color: accents carry a faint
`text-shadow`/`box-shadow` halo of their own hue (dark theme only, removed
under `prefers-reduced-motion`? no — glow is static, it stays; only motion
is reduced). Contrast: all text-on-surface pairs checked ≥4.5:1 (mono
labels ≥3:1 at ≥12px bold per WCAG large-text only if they pass; otherwise
darken/lighten `--ink-3` per theme — verified by the automated check).

## 2. Type roles

- **Sans (UI text, coach sentences):** Inter, self-hosted via
  `@fontsource/inter` (OFL). 13–15px body.
- **Mono (labels/status/controls/metrics — the instrument voice):**
  JetBrains Mono, self-hosted (OFL). 10–12px, letter-spacing .08–.14em,
  uppercase for labels; numbers tabular.
- **Serif (identity moments only):** Fraunces, self-hosted (OFL). The
  wordmark, onboarding headline, end-card, pose-poster title. Never in
  controls.
- Zero-network receipt stays true: fonts are bundled same-origin; no
  Google Fonts import. All three recorded in ASSETS.md.

## 3. Layout wireframe (desktop ≥1100px)

```
┌──────────────────────────────────────────────────────────────────────┐
│ POSEPUPPET ⌘K   [CHARACTER|HAND-ONLY|SETUP]   LOCAL·0 NET ◦ ● REC ◦ ☾│  command bar (glass, sticky, 1px bottom rule)
├───────────────────────────────────────────────┬──────────────────────┤
│ ┌─ stage (hero) ────────────────────────────┐ │ AVATARS              │
│ │‹corner ticks›                             │ │ ┌────────┬─────────┐ │
│ │                                           │ │ │astronaut│ robot  │ │  right rail:
│ │              AVATAR                       │ │ ├────────┴─────────┤ │  shared-border
│ │            (3D stage)                     │ │ │ + capability     │ │  avatar cards,
│ │                                           │ │ │   labels         │ │  mode card,
│ │                                  ‹ticks›  │ │ ├──────────────────┤ │  coach card,
│ └───────────────────────────────────────────┘ │ │ COACH            │ │  engineering
│ ┌─ camera signal ──────────┐                  │ │ "step back…"     │ │  view toggle
│ │ mirrored video + skeleton│                  │ ├──────────────────┤ │
│ │ CAM 30FPS ◦ POSE 29.7    │                  │ │ TUNING (sliders) │ │
│ └──────────────────────────┘                  │ └──────────────────┘ │
├───────────────────────────────────────────────┴──────────────────────┤
│ ⏺ TAKE ▸ CAM▸POSE 29.7▸RIG▸117FPS ▸ shot 2/7 "arms up" ▸ ◉◉◉○○○○      │  take bar = instrument strip
└──────────────────────────────────────────────────────────────────────┘
```

- Stage is the hero (left ~70%, full height of the main row); camera
  panel floats bottom-left inside the stage area as the "input signal"
  (draggable corner positions later if needed; fixed bottom-left now).
- Right rail 300–340px, its own scroll, shared-border card grid.
- Laptop-small (<1100px): rail collapses to an icon strip / overlay
  drawer; camera panel shrinks; take bar stays.
- Recording: chrome fades (`opacity .2s`), take bar becomes minimal
  transport, corner badge optional.

## 4. The signature element — the take bar as instrument strip

One continuous mono strip across the bottom, always present, reading like
hardware: left = transport (record/ghost/replay), center = **the signal
chain** — `CAM ▸ POSE 29.7 ▸ SMOOTH ▸ RIG ▸ RENDER 117` — each stage a
small mono cell that lights cyan when flowing and dims/red-shifts the
moment its stage stalls (camera lost, detection dropout, FPS sag). It is
the truth-teller of the whole app: occlusion events, coach triggers and
the perf auto-tuner all surface here first. Right = shot prompts during
takes (`SHOT 3/7 — FACE-TOUCH`), progress dots, gesture-armed indicator.
This is where boldness is spent; everything else stays disciplined.

## 5. Mono status label map (where the instrument voice lives)

| label | home |
|---|---|
| `LOCAL · 0 NETWORK REQUESTS SINCE LOAD` (green-white glow when 0) | command bar, right of mode selector |
| `LIVE` / `FILE` source chip | camera signal panel header |
| `CAM ▸ POSE ▸ SMOOTH ▸ RIG ▸ RENDER` chain with numbers | take bar center (signature) |
| `TRACKING / RE-ACQUIRING / NO SIGNAL` | camera panel footer + chain cell |
| avatar capability chips (`FULLY SUPPORTED`, `HANDS LIMITED`, …) | avatar cards |
| coach line (sans sentence, mono `COACH` eyebrow) | rail card + optional toast |
| shot prompt + progress | take bar right |
| `REC 00:12` + red dot | command bar record button + stage corner during takes |
| engineering view (all raw numbers, toggleable `d`) | overlay panel, mono everywhere |

## 6. Atmosphere & motion

- Grain: two-layer radial-gradient dot matrix (3px/7px), `screen` in dark,
  `multiply` in light, opacity .4 — **excluded over the stage and camera
  panes** (they sit above the grain layer; legibility law).
- Vignette: ellipse at 50% 20%, fixed, behind panels, never over video.
- Backdrop blur ONLY on static chrome (command bar, rail, palette,
  modals). Stage/camera overlays use gradient+opacity fakes.
- Motion: `blink` 2.4s on live dots; `reveal` translateY on cards once at
  load; crossfade on avatar switch; everything ≤ .3s ease; all of it
  behind `prefers-reduced-motion` (reduced: opacity-only, no transforms).
- Focus: 2px `--cyan` outline with 2px offset, visible on every control,
  both themes.

## 7. Self-critique (against the brief), and the revision it caused

1. *"Would this read as a template?"* First draft risked exactly the
   "near-black + one acid accent" cliché the brief names — fixed by
   making the four accents **role-bound** (blue=action, cyan=signal,
   violet=memory/ghost, green-white=privacy) so screens read polychrome
   but purposeful, and by the signal-chain strip, which no template has.
2. *"Does anything fight the live video?"* The first wireframe ran grain
   and vignette over everything including the stage; revised so video
   and stage are the cleanest pixels in the app — atmosphere lives on
   chrome only. Camera panel moved INSIDE the stage area (input signal
   reads as part of the cockpit, not a competing sibling pane).
3. Serif risk: Fraunces in controls would read editorial-blog; clamped to
   identity moments only (wordmark, onboarding, end card, poster).
4. Rail density: avatar cards + coach + tuning in one rail can crowd
   1280px laptops; revised to collapsible rail sections with mono
   headers (TUNING closed by default outside engineering view).
5. **Post-mockup (vision review of the screenshots):** the light theme's
   pale stage washed out the avatar and stage label. Revised once: light
   theme keeps a deep stage inside light chrome (the NLE-viewer pattern;
   the three.js scene owns its background anyway). Dark and take-state
   mockups passed review unchanged — the serif shot prompt over the stage
   is exactly the identity moment the type system reserves serif for.

## 8. Mockups

`design/mockups/shell.html` — the real app shell, static, both themes
(`?theme=dark|light`), plus a recording-state variant (`?state=take`).
Screenshots at 1440×810 committed as `design/mockups/*.png` (gitignore
exception; no personal footage in them — camera pane uses a synthetic
silhouette). These are the Gate-2 artifacts.
