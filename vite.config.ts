import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  server: {
    fs: {
      deny: [
        ".env", ".env.*", "*.{crt,pem,key,p12,pfx,cer,der}", ".npmrc", ".yarnrc.yml", "**/.git/**",
        "**/.portal-data.local/**", "**/.omx/**",
      ],
    },
  },
});
