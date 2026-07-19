precision highp float;

/**
 * REGION WATER SURFACE FRAGMENT SHADER (View from Below) — Checkpoint 04B
 * app-owned copy of the vendored WaterBelow.frag carrying ONLY the
 * sanctioned container swap (Master §4.2); see RegionWaterAbove.frag for
 * the shared swap inventory and the object-optics removal note.
 *
 * Byte-identical (protected): inverted-normal reconstruction, the
 * water→air IOR ratio, the underwater Fresnel base (0.5), Snell's-window
 * exit to the sky cubemap + sun spot, the refracted-color tint
 * vec3(0.8, 1.0, 1.1), and the final fresnel/refraction-length mix.
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

varying vec3 vPosition;

#include ./RegionContainer.glsl;
#include ./RegionSubstrate.glsl;
#include ./RegionWallColor.glsl;

/**
 * Vendored tracer with the pool box swapped for the seabed heightfield —
 * identical structure to the above-water copy (sky/Snell exit unchanged).
 */
vec3 getSurfaceRayColor(vec3 origin, vec3 ray, vec3 waterColor) {
  vec3 color;
  float t = raymarchSeabed(origin, ray);

  if (ray.y < 0.0) {
    // Hits the seabed heightfield; grazing misses drop onto the seabed
    // under the march end (see the above-water copy's note)
    vec3 hit = origin + ray * (t >= 0.0 ? t : RM_MAX);
    if (t < 0.0) hit.y = terrainHeight(hit.xz);
    color = getWallColor(hit);
  } else {
    // Exits water into air: exposed coastline, else sky cubemap (vendored)
    if (t >= 0.0) {
      color = getWallColor(origin + ray * t);
    } else {
      color = textureCube(sky, ray).rgb;
      // Add sun glow spot highlights — vendored
      color += vec3(pow(max(0.0, dot(light, ray)), 5000.0)) * vec3(10.0, 8.0, 6.0);
    }
  }

  // Modulate by water tinting if traveling inside water — vendored
  if (ray.y < 0.0) color *= waterColor;
  return color;
}

void main() {
  // Shoreline alpha-clip (same law as the above-water copy)
  if (terrainHeight(vPosition.xz) >= uSeaLevel || shoreLand(vPosition.xz) > 0.5) discard;

  // 1. World xz → sim-window UV
  vec2 coord = clamp(windowUv(vPosition.xz), 0.0, 1.0);
  vec4 info = texture2D(water, coord);

  // 2. Iterative parallax lookup — vendored
  for (int i = 0; i < 5; i++) {
    coord = clamp(coord + info.ba * 0.005, 0.0, 1.0);
    info = texture2D(water, coord);
  }

  // 3. Reconstruct surface normal (inverted for the underside) — vendored,
  // slope composited by the window falloff
  float wf = windowFalloff(windowUv(vPosition.xz));
  vec2 slope = clamp(info.ba * wf, vec2(-0.999), vec2(0.999));
  float slopeLengthSq = min(dot(slope, slope), 0.999);
  vec3 normal = normalize(vec3(slope.x, sqrt(max(0.001, 1.0 - slopeLengthSq)), slope.y));
  normal = -normal;

  // 4. Incoming eye view vector
  vec3 incomingRay = normalize(vPosition - eye);

  // 5. Reflect and refract (water → air ratio) — vendored
  vec3 reflectedRay = reflect(incomingRay, normal);
  vec3 refractedRay = refract(incomingRay, normal, IOR_WATER / IOR_AIR);

  // 6. Underwater Fresnel — vendored
  float fresnel = mix(0.5, 1.0, pow(1.0 - dot(normal, -incomingRay), 3.0));

  // 7. Raytrace both directions — vendored consumption
  vec3 reflectedColor = getSurfaceRayColor(vPosition, reflectedRay, underwaterColor);
  vec3 refractedColor =
    getSurfaceRayColor(vPosition, refractedRay, vec3(1.0)) * vec3(0.8, 1.0, 1.1);

  // 9. Mix based on fresnel and refracted-ray thickness — vendored
  gl_FragColor = vec4(
    mix(reflectedColor, refractedColor, (1.0 - fresnel) * length(refractedRay)),
    1.0
  );
}
