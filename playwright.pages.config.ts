import { defineConfig } from "@playwright/test";
import viewer from "./playwright.config.ts";

const port = Number(process.env.PAGES_TEST_PORT ?? 4177);
const baseURL = "http://127.0.0.1:" + port + "/ebbinghaus-lite/";

export default defineConfig({
  ...viewer,
  testDir: "./tests/pages",
  reporter: [["list"], ["json", { outputFile: "test-results/pages/results.json" }]],
  outputDir: "test-results/pages/artifacts",
  use: { ...viewer.use, baseURL },
  webServer: {
    command: "npm run preview:pages -- --port " + port,
    url: baseURL,
    reuseExistingServer: false,
  },
});
