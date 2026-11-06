import { defineConfig } from "@playwright/test";
import viewer from "./playwright.config.ts";

const baseURL = "http://127.0.0.1:4177/ebbinghaus-lite/";

export default defineConfig({
  ...viewer,
  testDir: "./tests/pages",
  reporter: [["list"], ["json", { outputFile: "test-results/pages/results.json" }]],
  outputDir: "test-results/pages/artifacts",
  use: { ...viewer.use, baseURL },
  webServer: {
    command: "npm run preview:pages",
    url: baseURL,
    reuseExistingServer: false,
  },
});
