import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";

const evidence = process.env.VIEWER_EVIDENCE_DIR;

export default defineConfig({
  testDir: "./tests/e2e",
  workers: 1,
  forbidOnly: true,
  retries: 0,
  reporter: [["list"], ["json", { outputFile: resolve(evidence ?? "test-results", "results.json") }]],
  outputDir: resolve(evidence ?? "test-results", "artifacts"),
  use: {
    baseURL: "http://127.0.0.1:4175",
    browserName: "chromium",
    // Launches a separate headless Chrome profile; never connects to an active browser.
    channel: "chrome",
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  webServer: {
    command: "npx vite preview --host 127.0.0.1 --port 4175 --strictPort",
    url: "http://127.0.0.1:4175",
    reuseExistingServer: false,
  },
});
