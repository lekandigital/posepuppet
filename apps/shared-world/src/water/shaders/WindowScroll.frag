precision highp float;

/**
 * SIM-WINDOW SCROLL-COPY SHADER — Checkpoint 04B (Master §4.3). New
 * app-owned functionality (no vendored counterpart): when the player-
 * following window's snapped origin moves by (di, dj) texels, the ping-pong
 * simulation state is carried over by copying the shifted region, with
 * calm water (all channels zero) injected at newly exposed edges.
 *
 * Runs with the vendored WaterRipple.vert fullscreen-quad vertex shader.
 */

uniform sampler2D tInput;
/** Origin shift in texture-UV units: (di, dj) / windowTexels. */
uniform vec2 shiftUv;

varying vec2 coord;

void main() {
  vec2 src = coord + shiftUv;
  if (src.x < 0.0 || src.x > 1.0 || src.y < 0.0 || src.y > 1.0) {
    gl_FragColor = vec4(0.0);
  } else {
    gl_FragColor = texture2D(tInput, src);
  }
}
