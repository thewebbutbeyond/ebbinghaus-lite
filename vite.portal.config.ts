import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import viewer from "./vite.config.ts";

export default defineConfig({
  ...viewer,
  build: {
    outDir: "dist-portal",
    rolldownOptions: {
      input: [
        fileURLToPath(new URL("./index.html", import.meta.url)),
        fileURLToPath(new URL("./portal/index.html", import.meta.url)),
      ],
    },
  },
});
