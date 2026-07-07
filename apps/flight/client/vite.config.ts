import { defineConfig } from "vite";
import path from "path";

export default defineConfig(({ command }) => ({
  // Built output is served by PosePuppet's dev server under /flight/ so both
  // apps share one origin (BroadcastChannel is origin-scoped). Standalone
  // `vite dev` keeps base '/' — the flight test suite runs it that way.
  base: command === "build" ? "/flight/" : "/",
  resolve: {
    alias: {
      "@globefly/shared": path.resolve(__dirname, "../shared"),
      // BodyArcade: protocol package consumed as TS source, same pattern as
      // PosePuppet's root vite config. Signals in, landmarks never.
      "@bodyarcade/body-input": path.resolve(
        __dirname,
        "../../../packages/body-input/src/index.ts",
      ),
    },
  },
  server: {
    port: 5173,
    /** Bind IPv4 + IPv6; otherwise on some systems only ::1 works and `localhost` → 127.0.0.1 fails. */
    host: true,
    fs: {
      // let vite serve body-input package source from outside apps/flight
      allow: [path.resolve(__dirname, ".."), path.resolve(__dirname, "../../../packages")],
    },
  },
}));
