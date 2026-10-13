import { defineConfig } from "@playwright/test";

// E2E runs against a server you start first (dev: `npm run dev`; release: the built preview).
// BASE_URL picks it; default is the local dev server.
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:4321",
    channel: process.env.CI ? undefined : "chrome",
    // e.g. PW_ARGS="--host-resolver-rules=MAP onemorething.today 104.21.6.22" to test production through a stale DNS cache.
    launchOptions: { args: process.env.PW_ARGS ? [process.env.PW_ARGS] : [] },
    reducedMotion: "reduce",
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
});
