# WaterThreeJS

A production-quality, real-time **ocean** rendered with [Three.js](https://threejs.org/) —
above *and* below the surface. Everything is procedural (no textures, no asset
downloads): the waves, the sky, the caustics and the volumetric light are all
generated in shaders.

## Features

**Surface**
- Spectral **Gerstner wave** field — dozens of waves spanning long swells down to
  fine chop, generated procedurally with deep-water dispersion so long waves
  travel faster than short ones.
- **Screen-space reflections**: the reflection ray is marched through the
  pre-water colour+depth buffer, so the island (and anything above water) is
  mirrored on the surface, falling back to the sky where the ray finds nothing.
- Three cascades of scrolling **detail normals** (coarse → capillary, the finest
  distance-faded to stop the horizon shimmering) layered over the Gerstner base.
- Physically-based shading: Schlick **Fresnel**, sky **reflection**, depth-based
  **refraction** with Beer–Lambert absorption (bright turquoise shallows fading to
  dark saturated deep), **subsurface scattering** on back-lit crests, sharp
  **sun glints**, and **layered foam** — a dense cap on breaking crests that
  dissolves softly into feathered, flow-aligned trails, so it never looks like a
  hard white stamp.
- A shared analytic **atmosphere** with **drifting procedural clouds** powers both
  the sky dome and the water reflections, so the horizon, clouds and sun always
  match exactly. Full time-of-day control from golden hour to noon.
- **Volumetric clouds** (toggle-able): a true raymarch through a camera-following
  high-altitude slab — 3D fBm density with height-falling coverage for organic
  rolling tops, a light-march for self-shadowing, a Henyey–Greenstein backlit
  silver lining and detail-erosion wisps — rendered at half-res, blurred, and
  composited into the HDR buffer before tone-map. Live controls for coverage,
  density, cloud size, roundness, wispiness, altitude, thickness, wind and light.

**Shore & island**
- A sand **island** heightfield rises from the seabed, through the waterline, up
  to dry dunes — dry → wet → submerged sand blended across the beach.
- The **shoreline** reads from the water-column depth: shallows go clear and
  turquoise (caustic-lit sand shows through), and an animated **foam band** piles
  up where the waves wash the beach.

**Floating objects**
- Drop **spheres / cubes** onto the sea (GUI buttons or **double-click** the
  water; Shift-double-click = cube). Each is a lightweight **buoyancy** body: it
  bobs on the wave surface, tilts to the local wave normal, drifts gently down
  the slope, and its submerged half shows through the water (refracted + tinted).
  The solver is **sub-stepped** and damped against the water's own velocity, so
  bodies ride a rising wave instead of being flung off it.
- **Grab and drag** any object with the mouse to reposition it, and release to
  fling it (dragging on open water still orbits the camera).
- **Terrain collision** — where the water is too shallow to float them (the
  island shelf / beach) they come to rest on the sand instead of sinking through,
  using a CPU mirror of the island heightfield.

**Underwater**
- Beer–Lambert **absorption / fog** — red light dies first, blue survives, giving
  the water real depth.
- Raymarched **volumetric god-rays** reconstructed from the depth buffer and
  modulated by a caustic pattern projected along the sun direction.
- Animated **caustics** on a rolling, rippled sandy **seabed**.
- **Snell's window**: from below, the surface reads as a bright, clear rippling
  ceiling — the whole sky refracted through the window with silvery caustic
  shimmer, the water glowing sunlit turquoise toward the surface (never black)
  and darkening with depth.
- Drifting **marine-snow** particles for a sense of scale.

**Pipeline**
- HDR (half-float) rendering with a separate refraction pass and depth textures.
- Post: threshold **bloom**, the underwater volumetrics pass, **ACES** filmic
  tone-mapping and sRGB output.
- Camera glides seamlessly between above- and below-water; the exact wave height
  at the camera is evaluated on the CPU to detect immersion.
- Six one-click **cinematic presets** — *Tropical Noon, Golden Hour, Crimson
  Sunset, Blue Hour, Clear Dawn, Stormy Seas* — each retunes the sun, water
  colour, waves, foam and post together for a complete look.
- Live, restyled **GUI** (glass panel, cyan accents) for the preset selector,
  waves, sun, surface, colour, foam, floating objects, underwater and post.

## Run

```bash
npm install
npm run dev      # opens http://localhost:5173
```

Build for production:

```bash
npm run build
npm run preview
```

## Controls

- **Drag** — orbit the camera
- **Scroll** — zoom
- **Right-drag / two-finger drag** — pan (use it to descend below the surface)
- **GUI › ▼ dive / ▲ surface** — animate across the waterline
- **GUI** (top-right) — tweak waves, time of day, foam, god-rays, exposure…

## Architecture

```
index.html            Boot screen, HUD, canvas
src/
  main.js             Renderer, camera, controls, render passes, immersion logic
  Sky.js              Camera-locked atmosphere dome
  Ocean.js            Gerstner surface mesh + full water shader (+ CPU height fn)
  Floor.js            Sandy seabed with dunes + animated caustics
  Island.js           Sand island heightfield: beach, wet/dry sand, caustics (+ CPU height)
  FloatingBodies.js   Buoyant dropped primitives: bob, tilt, terrain collision
  Particles.js        Marine-snow point field
  Clouds.js           Volumetric sky clouds — box-confined raymarch, low-res
  Post.js             Underwater volumetrics + cloud composite + bloom + ACES
  shaders/common.js   Shared GLSL: noise, atmosphere, Gerstner, caustics, tint
```

Everything outputs **linear HDR**; tone-mapping happens once in the final
composite so reflections, refraction and bloom all stay energy-consistent.

## How it works

Everything here runs on **WebGL2 + GLSL** through Three.js. There is no WebGPU,
no compute shaders and no FFT — the whole ocean is analytic shader math, which is
part of why it drops into any browser with zero assets.

### Rendering pipeline

One frame is a short chain of passes into **half-float (HDR)** render targets,
tone-mapped exactly once at the very end:

1. **Refraction pass** — sky + seabed + island (everything *below* the surface)
   rendered to an HDR colour target with a companion `DepthTexture`. Skipped
   while the camera is submerged.
2. **Scene pass** — the full scene, including the water surface, to a second HDR
   target. The water shader reads the refraction colour/depth from pass 1.
3. **Volumetric clouds** — a low-res raymarch (below) composited into the HDR
   buffer *before* tone-mapping.
4. **Post** — underwater absorption + god-rays, threshold bloom, then **ACES**
   filmic tone-map, grade and sRGB encode to the screen.

Keeping passes 1–3 in linear HDR is what lets reflections, refraction and bloom
stay energy-consistent — nothing is clamped to display range until the final
`aces()` call.

### Waves — an analytic Gerstner spectrum

The surface is a summed **Gerstner** wave field evaluated per-vertex on a
`600 × 600` grid that is grid-snapped to follow the camera (so vertices stay
world-anchored and detail is always underfoot). Instead of a big uniform array of
waves, the spectrum is generated procedurally in the loop from ~7 uniforms:

- Up to `MAX_WAVES = 40` waves (26 by default). Each wave's **direction and
  phase are seeded by a hash** of its index, so the field never visibly tiles.
- Frequency and amplitude follow geometric progressions per wave
  (`freq *= 1.19`, `amp *= 0.82`), spanning the long base swell (~150 m) down to
  fine chop.
- **Deep-water dispersion**: each wave's phase speed is `ω = √(g·k)`, so long
  swells genuinely travel faster than short ripples.
- Steepness `Q` is bounded per wave (`Q = choppy / (k·A·N)`) so crests sharpen
  toward a cusp without self-intersecting.

Two useful quantities fall out of the *same* summation loop, for free:

- the **analytic surface normal** (accumulated from each wave's slope — GPU Gems
  1, ch. 1), so no normal map or finite differencing is needed; and
- the **Jacobian determinant** of the horizontal displacement map. Where it goes
  negative the surface is pinching — a breaking crest — which is exactly where
  foam is seeded (see *Foam*).

### Surface detail

The vertex grid is too coarse for close-up ripple, so the fragment shader adds
**three cascades of scrolling detail normals** built from value noise with
*analytic derivatives* (after Inigo Quilez) — coarse → capillary. The two finest
cascades are faded out with distance (`exp(-dist·0.012)`) so the horizon reads as
a soft streak instead of aliasing into shimmering fireflies.

### Reflections — screen-space ray march

Reflections are **screen-space** (SSR): the reflected ray is marched (32 steps,
geometrically accelerating ×1.06) through the pre-water colour+depth target from
pass 1, so the island and anything above water are mirrored on the surface. On a
hit the intersection is refined between the last two samples, and a confidence
based on screen-edge proximity fades the reflection out cleanly. Where the ray
finds nothing it falls back to the **shared analytic atmosphere** — the same
`atmosphere()` function the sky dome uses — so the horizon, sun and clouds in the
reflection always match the real sky exactly.

### Refraction & water colour

The water column thickness at each pixel is the difference between the scene
depth (pass 1) and the surface depth. Colour through the water is **Beer–Lambert**:

```glsl
vec3 T = exp(-(ABSORB / clarity) * thickness);   // ABSORB = (0.45, 0.09, 0.04)
```

Red is absorbed first and blue survives, so shallow sand reads bright turquoise
and fades to a dark, saturated deep — the tropical depth gradient — with the
refracted seabed showing through, tinted and dimmed by that transmittance.

### Sun & specular

- **Fresnel** is Schlick with `F0 = 0.02` (water's ~2% normal reflectance),
  blending refraction into reflection toward grazing angles.
- **Sun glints** use a **GGX / Trowbridge-Reitz** specular lobe whose size tracks
  a micro-roughness uniform (and widens with distance), for a physically-shaped
  sparkle rather than a hard dot. An optional high-frequency normal jitter
  shatters the reflected sun into moving *glitter* on calm water.
- **Subsurface scattering**: a gentle translucent glow is added only through
  thin, back-lit crests (`pow(dot(V, -sunDir), 4) · crest`).

### Foam

Foam is a single 0–1 "energy" field assembled from four sources — breaking folds
(the Gerstner Jacobian), whitecap crests above a height threshold, a
depth-driven **shore band**, and **contact foam** (rings, wind-stretched *wakes*
and splash bursts) from the floating objects, whose positions and velocities are
fed into the shader every frame. That energy dissolves through layered,
wind-stretched FBM so foam feathers into trails and dissipates softly instead of
stamping a hard white shape, with a second sparse layer of the brightest fresh
foam on strong breaks.

### Underwater

- **Absorption fog** toward the deep-water colour, again Beer–Lambert.
- **Volumetric god-rays**: a 28-step ray march that reconstructs each pixel's
  world position from the depth buffer, samples an animated **caustic** pattern
  *projected up the sun direction* to the surface, and weights the accumulation
  by a **Henyey–Greenstein** phase (`g = 0.72`) so the shafts glow toward the sun.
- **Snell's window**: looking up, the surface is `refract()`-ed water→air at
  `IOR 1.333`. Inside the ~48.6° critical-angle cone the whole sky is refracted
  into a bright rippling ceiling; past it, total internal reflection falls back to
  a sunlit turquoise water glow (never black). Silvery caustic shimmer is layered
  on top so it always reads as *water*, not sky.
- Animated **caustics** on a rolling seabed, plus drifting marine-snow particles
  for scale.

### Volumetric clouds

A true raymarch through a camera-following high-altitude **slab** (ray/box
intersection bounds the march), rendered at **half resolution** and cleaned up
with **temporal reprojection** — each frame is jittered differently and blended
(0.88) with the neighbourhood-clamped reprojected history, so a cheap ~44-step
march converges to a clean image. Lighting per sample is a **5-tap exponential
light march** for self-shadowing, **Beer–Powder** darkening on thin edges, a
3-octave **multi-scattering** approximation so thick clouds glow instead of going
black, and a dual-lobe **Henyey–Greenstein** phase for the backlit silver lining.
The same clouds cast **drifting shadows on the sea** by sampling the *same* 3D
fBm, sliced at the layer midplane along the sun ray.

### Floating bodies — a CPU wave mirror

Buoyancy needs the height of the *visible* crest, but Gerstner waves push
vertices sideways — the water you see above `(x, z)` was displaced there from a
different rest position. `Ocean.js` keeps an **exact CPU port** of the GLSL wave
sum and inverts that horizontal map with **4 fixed-point iterations**, so dropped
spheres/cubes ride the real crests instead of clipping through them. The solver
is sub-stepped and damped against the water's own velocity; where the water is
too shallow to float them, a CPU mirror of the island heightfield catches them on
the sand.

### Post & grade

Threshold bright-pass → separable Gaussian bloom (two iterations, the second
horizontal pass stretched for a subtle **anamorphic** streak) → ACES filmic
tone-map → saturation/contrast S-curve, animated **film grain**, radial
**chromatic aberration** and vignette → sRGB. This is the single point where the
HDR frame is mapped to display range.

## Requirements

A WebGL2-capable browser (Chrome, Edge, Firefox, Safari). The scene targets
desktop GPUs; on lighter hardware, reduce the wave grid `segments` in
`src/Ocean.js` and the god-ray step count in `src/Post.js`.
