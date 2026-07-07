// Minimal allocation-conscious vec3 math. The package is deliberately
// three.js-free: consumers bring their own renderer (and three version).

export interface V3 {
  x: number;
  y: number;
  z: number;
}

export const v3 = (x = 0, y = 0, z = 0): V3 => ({ x, y, z });

export function set(o: V3, x: number, y: number, z: number): V3 {
  o.x = x;
  o.y = y;
  o.z = z;
  return o;
}

export function copy(o: V3, a: V3): V3 {
  return set(o, a.x, a.y, a.z);
}

export function sub(o: V3, a: V3, b: V3): V3 {
  return set(o, a.x - b.x, a.y - b.y, a.z - b.z);
}

export function mid(o: V3, a: V3, b: V3): V3 {
  return set(o, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
}

export function cross(o: V3, a: V3, b: V3): V3 {
  return set(o, a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
}

export function dot(a: V3, b: V3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function len(a: V3): number {
  return Math.hypot(a.x, a.y, a.z);
}

export function dist(a: V3, b: V3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

/** normalize in place; returns false (vector untouched) when degenerate */
export function norm(a: V3): boolean {
  const l = len(a);
  if (l < 1e-6) return false;
  a.x /= l;
  a.y /= l;
  a.z /= l;
  return true;
}

/** MediaPipe → internal y-up space: (x, −y, −z). +z faces the viewer. */
export function mpToInternal(p: { x: number; y: number; z: number }, o: V3): V3 {
  return set(o, p.x, -p.y, -p.z);
}
