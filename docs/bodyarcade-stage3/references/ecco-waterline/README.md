# Ecco Waterline and Cross-Surface Visibility Reference

> **Scope note (2026-08-08).** The ocean-replacement addendum
> (`../../decisions/POST_CP05B_OCEAN_REPLACEMENT_AMENDMENTS.md`) replaced the
> region water with the WaterThreeJS port at Checkpoint 05C. This document's
> water-system prescriptions — the "Intended implementation hierarchy", the
> "one coherent water system / do not introduce a separate replacement
> renderer" rule, and the per-checkpoint implementation ownership — are
> **superseded**. The 13 frames and the behavior-level acceptance requirements
> (continuity across the waterline, smooth visibility variation, a surface
> that never reads frozen, stock/pool demos remaining functional) remain valid
> composition and behavior references for the re-scoped CP06/CP08.

## Purpose

These selected frames from *Ecco the Dolphin: Defender of the Future* define the visual-behavior reference for BodyArcade's ocean surface, breach camera, cross-waterline visibility, and split-level rendering.

They are an acceptance reference rather than a requirement for pixel-identical reproduction.

Claude must inspect these images before implementing or reviewing:

- Checkpoint 05B: ambient ocean surface motion and shoreline interaction
- Checkpoint 06: breach, re-entry, and cross-waterline continuity
- Checkpoint 08: final waterline optics, underwater atmosphere, and visibility tuning

## Core observations

The water surface must not behave as simply opaque from above and transparent from below.

Visibility through the surface varies continuously according to:

- camera position relative to the surface
- viewing angle and Fresnel reflection
- water depth
- horizontal distance
- underwater fog and attenuation
- surface slope and animated normal distortion
- disturbance from swimming, breach, and re-entry

The dolphin, terrain, and other geometry must remain spatially continuous while crossing the waterline.

The renderer must not abruptly clip or hide the portion of an object lying on the opposite side of the surface.

Opposite-side geometry does not need to be equally visible under every condition. It may be:

- clearly visible
- faintly visible
- heavily distorted
- dominated by reflection
- effectively concealed by distance, fog, angle, or surface conditions

The requirement is coherent optical variation rather than an artificial hard cutoff.

## Split-level rendering

Split-level views must support two simultaneous optical regions:

- Above-water pixels use above-water lighting, sky, color, reflection, and atmosphere.
- Underwater pixels use underwater tint, attenuation, fog, haze, and distortion.
- The waterline is a narrow moving refractive boundary rather than a hard scene cut.
- A dolphin or terrain feature crossing the surface remains one continuous object across both regions.

## Frame index

### 1. Breach peak and pre-entry visibility

**Image:** `ATLAS_02/D08_R0006__page-013__cell-4.png`

The camera is above the surface near the peak of a breach, shortly before re-entry.

The dolphin is clearly readable above water while parts of the underwater environment remain somewhat visible through the surface.

Use this frame to evaluate:

- breach peak height
- breach camera framing
- above-water dolphin readability
- partial visibility through the water
- the transition toward re-entry

### 2. Underwater camera viewing above-water terrain

**Image:** `ATLAS_01/D05_R0011__page-030__cell-1.png`

The camera is underwater and close to the surface.

Terrain extending above the surface remains visible through the waterline with an underwater-facing optical treatment.

Use this frame to verify that above-water terrain is not clipped merely because the camera is underwater.

### 3. Submerged dolphin visible from above

**Image:** `ATLAS_02/D09_S0007__page-018__cell-6.png`

After re-entry, the camera remains above water while the submerged dolphin remains visible through the surface.

Use this frame to evaluate:

- continuity immediately after re-entry
- visibility of the submerged body from above
- gradual transition between above-water and underwater presentation
- absence of sudden popping or disappearance

### 4. Above-water view into the underwater environment

**Image:** `ATLAS_02/D10_R0022__page-037__cell-2.png`

The camera is above the surface, yet submerged terrain, vegetation, and parts of the floor remain visible through the water.

This demonstrates that the above-water surface is not always fully opaque.

Reflection and transmission must vary with view angle, surface movement, depth, and distance.

### 5. Reflection-dominated underwater view

**Image:** `ATLAS_03/D10_R0122__page-014__cell-1.png`

The camera is underwater and near the surface.

Above-water terrain is barely visible or effectively concealed by the distorted underside of the surface.

The underside shows strong animated refractive patterns resembling layered moving normal-map distortion.

Use this frame as the low-visibility end of the acceptable underwater-to-above-water range.

### 6. Clear underwater view of above-water terrain

**Image:** `ATLAS_03/D10_R0131__page-016__cell-5.png`

The camera remains underwater near the surface, but above-water terrain is substantially more visible than in the previous frame.

The contrast between frames 5 and 6 demonstrates that visibility must vary with angle, camera position, surface shape, and local conditions.

### 7. Strong near-surface cross-water visibility

**Image:** `ATLAS_04/D12_R0037__page-001__cell-2.png`

The camera is underwater near the surface.

Above-water terrain is clearly visible through the animated water surface.

### 8. Strong visibility with surface distortion

**Image:** `ATLAS_04/D12_R0039__page-002__cell-3.png`

The camera is underwater near the surface.

Terrain above the surface remains readable while being filtered through moving refraction and surface distortion.

### 9. Strong visibility from another nearby angle

**Image:** `ATLAS_04/D12_R0040__page-002__cell-4.png`

Another underwater near-surface view in which above-water terrain remains clearly visible.

Frames 7 through 9 establish that strong opposite-side terrain visibility is common under favorable near-surface viewing conditions.

### 10. Nearby terrain visible from the ocean floor

**Image:** `ATLAS_04/D12_R0043__page-003__cell-2.png`

The camera is deeper and near the ocean floor.

Nearby terrain that extends above the surface remains visible, while more horizontally distant terrain fades or disappears.

Use this frame to tune:

- distance-dependent underwater visibility
- horizontal attenuation
- depth fog
- preservation of nearby silhouettes
- disappearance of distant terrain without an abrupt cutoff

### 11. Deep-water distance and composition reference

**Image:** `ATLAS_04/D12_R0102__page-017__cell-1.png`

The camera is near the ocean floor.

Above-water terrain is not clearly available for comparison because it is not meaningfully in frame or may be occluded. More distant terrain is also not readable.

Do not use this frame alone to conclude that cross-surface visibility is disabled.

Use it primarily as a reference for deep-water fog, distance, visibility falloff, and composition.

### 12. Split-level camera with simultaneous optical regions

**Image:** `ATLAS_04/D12_S0028__page-015__cell-2.png`

The camera displays above-water and underwater regions simultaneously.

Required behavior:

- above-water terrain retains above-water lighting and color
- submerged terrain and the submerged dolphin receive underwater tint and attenuation
- both regions remain visible in the same frame
- the waterline remains a moving refractive boundary rather than clipping the scene

### 13. Split-level view biased toward the underwater side

**Image:** `ATLAS_04/D12_S0029__page-015__cell-3.png`

The camera is positioned from a more underwater-biased perspective while showing both sides of the surface.

Above-water terrain appears filtered through the underwater-facing surface treatment.

Use this frame to evaluate:

- camera-side-dependent rendering
- waterline transition behavior
- above-water terrain seen through the underside of the surface
- continuous geometry across the surface boundary

## Waterline optical requirements

Render above-water and underwater geometry continuously through the water surface.

Apply camera-side-dependent:

- refraction
- reflection
- Fresnel response
- attenuation
- fog
- tint
- animated normal-map distortion
- depth and distance visibility falloff

Do not use hard waterline clipping to hide the opposite side of the scene.

The terrain, dolphin, and other intersecting geometry must remain continuous while crossing the surface.

## Surface-motion requirements

The ocean must never become completely motionless while the dolphin is idle.

### Ambient ocean motion

Maintain low-amplitude, low-frequency swell and animated normal-map motion across the entire surface.

This baseline remains active continuously.

### Terrain and shoreline interaction

Ambient waves moving against cliffs, shorelines, rocks, islands, and protruding terrain must create persistent low-level boundary disturbance.

The terrain does not need to move.

The moving water field interacting with the static boundary creates the ripple response.

This should resemble the pool demonstration's obstacle interaction, except the incoming motion is supplied by ambient ocean waves rather than requiring the obstacle to move.

### Dolphin swimming

Swimming produces stronger local wake, displacement, and trailing disturbance than the ambient baseline.

### Breach and re-entry

Breach and re-entry create the strongest temporary impulses.

These disturbances decay gradually back toward the continuously moving ambient ocean state.

## Intended implementation hierarchy

```text
global low-frequency swell
+ animated surface-normal detail
+ shoreline and terrain-boundary forcing
+ dolphin swimming and wake impulses
+ breach and re-entry impulses
= final ocean surface motion
```

This must remain one coherent water system.

Do not introduce a separate replacement renderer solely for these effects.

## Checkpoint ownership

### Checkpoint 05B

Implement and validate:

- continuous ambient ocean motion
- animated underside distortion
- low-level shoreline and terrain-boundary interaction
- stronger local wake from ordinary dolphin swimming
- preservation of the approved existing above-water water appearance

### Checkpoint 06

Implement and validate:

- breach camera behavior
- breach peak and re-entry framing
- geometry continuity across the waterline
- dolphin continuity during partial submersion
- strongest breach and re-entry surface impulses
- above-water visibility of the dolphin immediately after re-entry
- underwater visibility of above-water terrain under appropriate conditions

### Checkpoint 08

Refine and validate:

- reflection and transmission balance
- Fresnel behavior
- underwater tint and attenuation
- horizontal and depth visibility falloff
- animated normal-map refraction
- split-level rendering
- distance fog
- variation between clear and reflection-dominated views
- final correspondence with this reference set

## Acceptance requirements

- No hard clipping of the dolphin or terrain at the waterline.
- A partially submerged dolphin remains continuous across both optical regions.
- Underwater cameras can see above-water terrain under favorable conditions.
- Above-water cameras can see submerged geometry under favorable conditions.
- Visibility changes smoothly with depth, distance, angle, reflection, and disturbance.
- Visibility is not required to be uniform in every frame.
- Split-level shots render both optical regions simultaneously.
- The underside of the surface has continuous animated refractive motion.
- Static terrain boundaries produce low-level ripples from ambient wave interaction.
- Swimming produces stronger localized disturbance than the ambient baseline.
- Breach and re-entry produce the largest transient disturbance.
- Disturbances decay toward a continuously moving ocean rather than a perfectly still surface.
- Existing approved above-water water appearance must not regress unnecessarily.
- The stock water demonstration and pool demonstration must remain functional.
