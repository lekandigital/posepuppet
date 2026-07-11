import { defineConfig } from "@playwright/test";

const PP_PORT = process.env.PP_PORT ?? "5173";

// BodyArcade Flight suite — separate from PosePuppet's root suite so the
// two apps stay independently green. Port 5199 avoids PosePuppet's 5173.
export default defineConfig({
  testDir: "./tests",
  timeout: 90_000,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:5199",
    viewport: { width: 1280, height: 720 },
  },
  webServer: [
    {
      command: "npm run dev -w client -- --port 5199 --strictPort",
      url: "http://localhost:5199",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      // PosePuppet (the body-signal producer) for closed-loop specs.
      command: `npm run dev --prefix ../.. -- --port ${PP_PORT} --strictPort`,
      url: `http://localhost:${PP_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
