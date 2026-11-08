import assert from "node:assert/strict";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

test("the standalone Vite dev server cannot serve ignored private files", async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "ebbinghaus-vite-")));
  const privateDir = join(root, ".portal-data.local");
  const manifest = join(privateDir, "manifest.json");
  const archiveDir = join(root, ".archive-materials.local");
  await mkdir(privateDir);
  await mkdir(archiveDir);
  await writeFile(manifest, "fictional-portal-marker");
  await writeFile(join(archiveDir, "private.pdf"), "fictional-archive-marker");
  const vite = await createServer({
    configFile: fileURLToPath(new URL("../vite.config.ts", import.meta.url)),
    root,
    logLevel: "silent",
    server: { host: "127.0.0.1", port: 0, hmr: false, watch: null },
  });
  try {
    await vite.listen();
    const address = vite.httpServer?.address();
    assert(address && typeof address !== "string");
    for (const path of ["/.portal-data.local/manifest.json", "/@fs" + manifest,
      "/.archive-materials.local/private.pdf", "/@fs" + join(archiveDir, "private.pdf")]) {
      const response: Response = await fetch("http://127.0.0.1:" + address.port + path);
      assert.equal(response.status, 403, path);
      assert.doesNotMatch(await response.text(), /fictional-(portal|archive)-marker/);
    }
  } finally {
    await vite.close();
    await rm(root, { recursive: true, force: true });
  }
});
