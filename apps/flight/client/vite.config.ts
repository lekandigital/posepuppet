import { defineConfig, type Plugin } from "vite";
import path from "path";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";

const PP_PUBLIC = path.resolve(__dirname, "../../../public");

/** Dev-only: serve /models and /mediapipe-wasm from PosePuppet public/ —
 *  the pose-runtime asset convention. The production topology (built app
 *  under /flight/ on PosePuppet's server) serves them from the shared
 *  origin already; this mirrors that for the standalone dev server. */
function poseAssets(): Plugin {
  const MIME: Record<string, string> = {
    ".task": "application/octet-stream",
    ".js": "text/javascript",
    ".wasm": "application/wasm",
  };
  return {
    name: "bodyarcade-pose-assets",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? "").split("?")[0]!;
        if (!url.startsWith("/models/") && !url.startsWith("/mediapipe-wasm/")) return next();
        const file = normalize(join(PP_PUBLIC, decodeURIComponent(url)));
        if (!file.startsWith(resolve(PP_PUBLIC)) || !existsSync(file) || !statSync(file).isFile()) {
          res.statusCode = 404;
          return res.end("not found");
        }
        res.setHeader("Content-Type", MIME[extname(file)] ?? "application/octet-stream");
        createReadStream(file).pipe(res);
      });
    },
  };
}

export default defineConfig(({ command }) => ({
  // Built output is served by PosePuppet's dev server under /flight/ so both
  // apps share one origin (BroadcastChannel is origin-scoped). Standalone
  // `vite dev` keeps base '/' — the flight test suite runs it that way.
  base: command === "build" ? "/flight/" : "/",
  plugins: [poseAssets()],
  resolve: {
    alias: {
      "@globefly/shared": path.resolve(__dirname, "../shared"),
      // BodyArcade: protocol + runtime packages consumed as TS source, same
      // pattern as PosePuppet's root vite config. Signals in, landmarks never.
      "@bodyarcade/body-input": path.resolve(
        __dirname,
        "../../../packages/body-input/src/index.ts",
      ),
      "@bodyarcade/pose-runtime": path.resolve(
        __dirname,
        "../../../packages/pose-runtime/src/index.ts",
      ),
      "@bodyarcade/pose-hud": path.resolve(
        __dirname,
        "../../../packages/pose-hud/src/index.ts",
      ),
    },
  },
  server: {
    port: 5173,
    /** Bind IPv4 + IPv6; otherwise on some systems only ::1 works and `localhost` → 127.0.0.1 fails. */
    host: true,
    fs: {
      // let vite serve body-input/pose-runtime/pose-hud package source
      allow: [path.resolve(__dirname, ".."), path.resolve(__dirname, "../../../packages")],
    },
  },
}));
