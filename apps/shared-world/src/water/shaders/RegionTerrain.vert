/**
 * REGION TERRAIN VERTEX SHADER — Checkpoint 04B replacement for the vendored
 * Cube.vert pool-box remap (Master §4.2 "pool wall shader" row). The
 * geometry is the cp04A graybox grid built from the baked heightfield in
 * world meters, so no coordinate remap is needed; the fragment shader owns
 * all shading (normals come from uHeightTex per fragment — single source).
 */

varying vec3 vPosition;

void main() {
  vPosition = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
