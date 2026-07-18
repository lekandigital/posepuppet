/// <reference types="vite/client" />

// Shader-module declarations for the vendored jeantimex sources pulled into
// this app's type-check via the import graph (the vendored tree's own
// vite-env.d.ts sits outside this tsconfig's include set). Mirrors
// vendor/threejs-water/src/vite-env.d.ts.

declare module '*.glsl' {
  const value: string;
  export default value;
}

declare module '*.vert' {
  const value: string;
  export default value;
}

declare module '*.frag' {
  const value: string;
  export default value;
}
