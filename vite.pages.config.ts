import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import viewer from "./vite.config.ts";

export default defineConfig({
  ...viewer,
  base: "/ebbinghaus-lite/",
  appType: "mpa",
  publicDir: false,
  build: {
    outDir: "dist-pages",
    rolldownOptions: {
      input: [
        fileURLToPath(new URL("./index.html", import.meta.url)),
        fileURLToPath(new URL("./lite/index.html", import.meta.url)),
      ],
    },
  },
});
