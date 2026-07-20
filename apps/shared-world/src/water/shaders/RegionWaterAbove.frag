precision highp float;

/**
 * REGION WATER SURFACE FRAGMENT SHADER (View from Above) — Checkpoint 04B
 * app-owned copy of the vendored WaterAbove.frag carrying ONLY the
 * sanctioned container swap (Master §4.2):
 *
 *  - `intersectCube` / `poolHeight` box hits → `raymarchSeabed` against the
 *    baked height texture (RegionContainer.glsl);
 *  - `getWallColor` tiles/box → terrain material at the raymarched hit
 *    (RegionWallColor.glsl); same consumption by `getSurfaceRayColor`;
 *  - shoreline alpha-clip: `discard` where terrainHeight ≥ uSeaLevel
 *    (uShoreMask cross-check — sign-exact by bake law);
 *  - wave texture coords through the player-following window; slopes faded
 *    by the window falloff into the global calm surface (Master §4.3).
 *
 * Byte-identical (protected): parallax-refinement loop, normal
 * reconstruction, Fresnel/Schlick composition, Snell refraction, sky-cubemap
 * sampling + sun spot, Beer's-law water tint, final fresnel mix.
 *
 * Removed relative to the vendored file (documented deviation, cp04B
 * report): the sphere/cube/torus-knot analytic object branches — no
 * approved view ever enables those primitives, and under enabled=false the
 * vendored branches contribute nothing.
 *
 * CP06 Phase One RESTORES the vendored MESH object-optics branch (the
 * duck's mechanism) for the regional actor: `sampleObjectRefraction` /
 * the clipped-reflection projected sample, gated by `meshEnabled`, exactly
 * as in the vendored WaterAbove.frag step 8. The dolphin becomes visible
 * THROUGH the surface (submerged from above; reflection of the emerged
 * body) instead of being hidden by the opaque traced color.
 */

const float IOR_AIR = 1.0;
const float IOR_WATER = 1.333;

const vec3 abovewaterColor = vec3(0.25, 1.0, 1.25);
const vec3 underwaterColor = vec3(0.4, 0.9, 1.0);

uniform vec3 light;
uniform sampler2D causticTex;
uniform sampler2D water;
uniform samplerCube sky;
uniform vec3 eye;
// CP06 restored mesh-optics uniforms (vendored names; meshCenter /
// meshShadowRadius / meshEnabled are declared in RegionWallColor.glsl)
uniform float meshBoundingRadius;
uniform sampler2D objectRefractionTex;
uniform sampler2D objectClippedReflectionTex;
uniform mat4 viewProjectionMatrix;
uniform mat4 reflectionViewProjectionMatrix;

varying vec3 vPosition;

#include ./RegionContainer.glsl;
#include ./RegionAmbient.glsl;
#include ./RegionSubstrate.glsl;
#include ./RegionWallColor.glsl;

/**
 * CP06 restored vendored helpers (WaterAbove.frag, byte-identical):
 * sphere-bounds entry test + projected-texture sampling for the mesh
 * object's pre-rendered refraction/reflection passes.
 */
float intersectSphereBounds(vec3 origin, vec3 ray, vec3 center, float radius) {
  vec3 toSphere = origin - center;
  float a = dot(ray, ray);
  float b = 2.0 * dot(toSphere, ray);
  float c = dot(toSphere, toSphere) - radius * radius;
  float discriminant = b * b - 4.0 * a * c;
  if (discriminant > 0.0) {
    float root = sqrt(discriminant);
    float near = (-b - root) / (2.0 * a);
    float far = (-b + root) / (2.0 * a);
    if (near > 0.0) return near;
    if (far > 0.0) return 0.0;
  }
  return 1.0e6;
}

vec4 sampleProjectedTexture(sampler2D tex, mat4 matrix, vec3 point) {
  vec4 clip = matrix * vec4(point, 1.0);
  vec3 ndc = clip.xyz / max(clip.w, 1.0e-6);
  vec2 uv = ndc.xy * 0.5 + 0.5;
  float inBounds =
    step(0.0, uv.x) * step(0.0, uv.y) * step(uv.x, 1.0) * step(uv.y, 1.0) * step(0.0, clip.w);
  return texture2D(tex, clamp(uv, 0.0, 1.0)) * inBounds;
}

vec4 sampleObjectRefraction(vec3 origin, vec3 ray, vec3 center, float radius) {
  float hit = intersectSphereBounds(origin, ray, center, radius);
  if (hit >= 1.0e6) return vec4(0.0);
  return sampleProjectedTexture(objectRefractionTex, viewProjectionMatrix, origin + ray * hit);
}

/**
 * Ray-traces a single ray to determine the color seen in that direction —
 * the vendored tracer with the pool box swapped for the seabed heightfield.
 * Downward rays that out-run the march (grazing angles, > 192 m) shade the
 * march-end point (deep, dark by distance — the region's abyss falloff).
 * Upward rays hit exposed coastline (the "pool wall above water line"
 * branch, generalized) or escape to the vendored sky + sun spot, unchanged.
 */
vec3 getSurfaceRayColor(vec3 origin, vec3 ray, vec3 waterColor) {
  vec3 color;
  float t = raymarchSeabed(origin, ray);
  float underwaterPath = 0.0;

  if (ray.y < 0.0) {
    // RAY POINTS DOWNWARD - hits the seabed heightfield. Grazing rays that
    // out-run the march (> 192 m) drop onto the seabed under the march end
    // so the far field shades continuously with the last real hits
    // [DERIVED miss-path completion — reported].
    float tHit = t >= 0.0 ? t : RM_MAX;
    vec3 hit = origin + ray * tHit;
    if (t < 0.0) hit.y = terrainHeight(hit.xz);
    color = getWallColor(hit);
    underwaterPath = tHit;
  } else {
    // RAY POINTS UPWARD - exits water into air
    if (t >= 0.0) {
      // Hit exposed coastline terrain above the water line
      color = getWallColor(origin + ray * t);
    } else {
      // Escaped to sky - sample environment cubemap (vendored, unchanged)
      color = textureCube(sky, ray).rgb;
      color += vec3(pow(max(0.0, dot(light, ray)), 5000.0)) * vec3(10.0, 8.0, 6.0);
    }
  }

  // WATER COLOR ABSORPTION — the vendored Beer-Lambert approximation in
  // path-length form (cp05A correction; see waterPathTint)
  if (ray.y < 0.0) color *= waterPathTint(waterColor, underwaterPath);

  return color;
}

void main() {
  // SHORELINE ALPHA-CLIP (Master §4.2 "surface mesh extent"; Track B Q5):
  // no surface fragment over land — refraction at the shoreline then hits
  // terrain naturally and no z-fight against the beach can occur.
  if (terrainHeight(vPosition.xz) >= uSeaLevel || shoreLand(vPosition.xz) > 0.5) discard;

  // STEP 1: COORDINATE MAPPING — world xz → sim-window UV
  vec2 coord = clamp(windowUv(vPosition.xz), 0.0, 1.0);
  vec4 info = texture2D(water, coord);

  // STEP 2: PARALLAX DISPLACEMENT (iterative refinement) — vendored
  for (int i = 0; i < 5; i++) {
    coord = clamp(coord + info.ba * 0.005, 0.0, 1.0);
    info = texture2D(water, coord);
  }

  // STEP 3: NORMAL RECONSTRUCTION — vendored, with the slope composited
  // into the global calm surface by the window falloff (Master §4.3).
  // CP05B: the ambient swell + boundary-response slope (RegionAmbient.glsl)
  // is ADDED to the sim slope before the vendored reconstruction — the
  // reconstruction, Fresnel and ray math consuming it are untouched.
  float wf = windowFalloff(windowUv(vPosition.xz));
  vec2 slope = clamp(info.ba * wf + ambientSurf(vPosition.xz).yz, vec2(-0.999), vec2(0.999));
  float slopeLengthSq = min(dot(slope, slope), 0.999);
  vec3 normal = normalize(vec3(slope.x, sqrt(max(0.001, 1.0 - slopeLengthSq)), slope.y));

  // STEP 4: View ray from camera to this surface point
  vec3 incomingRay = normalize(vPosition - eye);

  // STEP 5: REFLECTION AND REFRACTION RAYS — vendored
  vec3 reflectedRay = reflect(incomingRay, normal);
  vec3 refractedRay = refract(incomingRay, normal, IOR_AIR / IOR_WATER);

  // STEP 6: FRESNEL REFLECTANCE (Schlick's approximation) — vendored
  float fresnel = mix(0.25, 1.0, pow(1.0 - dot(normal, -incomingRay), 3.0));

  // STEP 7: Ray trace to find colors for both rays — vendored consumption
  vec3 reflectedColor = getSurfaceRayColor(vPosition, reflectedRay, abovewaterColor);
  vec3 refractedColor = getSurfaceRayColor(vPosition, refractedRay, abovewaterColor);

  // STEP 8 (CP06 restored): blend the pre-rendered refraction/clipped-
  // reflection passes for the mesh actor — the vendored WaterAbove.frag
  // meshEnabled branch, byte-identical consumption
  if (meshEnabled) {
    vec4 refractedObject = sampleObjectRefraction(
      vPosition,
      refractedRay,
      meshCenter,
      meshBoundingRadius
    );
    refractedColor = mix(refractedColor, refractedObject.rgb, refractedObject.a);
    // Use clipped reflection texture to ensure parts below water are not rendered in reflection map
    vec4 reflectedObject = sampleProjectedTexture(
      objectClippedReflectionTex,
      reflectionViewProjectionMatrix,
      vPosition
    );
    reflectedColor = mix(reflectedColor, reflectedObject.rgb, reflectedObject.a);
  }

  // Mix colors based on fresnel intensity — vendored
  gl_FragColor = vec4(mix(refractedColor, reflectedColor, fresnel), 1.0);
}
