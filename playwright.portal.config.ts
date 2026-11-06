import { defineConfig } from "@playwright/test";
import viewer from "./playwright.config.ts";

export default defineConfig({
  ...viewer,
  testDir: "./tests/portal",
  webServer: undefined,
  reporter: [["list"], ["json", { outputFile: "test-results/portal/results.json" }]],
  outputDir: "test-results/portal/artifacts",
});
