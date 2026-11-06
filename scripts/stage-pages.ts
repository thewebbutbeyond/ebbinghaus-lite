import { copyFile, lstat, mkdir, readFile, realpath, rename, rmdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { parseDeck } from "../src/import.ts";
import { catalog } from "../src/lite-catalog.ts";

const output = resolve("dist-pages");
const publication = await realpath("publication");
const paths = new Set<string>();
for (const institution of catalog) {
  for (const department of institution.departments) {
    for (const course of department.courses) {
      const updated = new Date(course.updatedOn);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(course.updatedOn) ||
          !Number.isFinite(updated.getTime()) || updated.toISOString().slice(0, 10) !== course.updatedOn) {
        throw new Error("Invalid last update date for course: " + course.id);
      }
      for (const [kind, resources] of [
        ["json", course.decks], ["pdf", [...course.sheets, ...course.corrections]],
      ] as const) {
        for (const { path } of resources) {
          if (!/^cours\/[a-z0-9-]+\/[A-Za-z0-9-]+\.(json|pdf)$/.test(path) ||
              !path.endsWith("." + kind) || paths.has(path)) {
            throw new Error("Invalid or duplicate public resource: " + path);
          }
          const source = join(publication, path);
          if (!(await lstat(source)).isFile() || await realpath(source) !== source) {
            throw new Error("Public resource must be a regular file: " + path);
          }
          if (kind === "json") {
            const result = parseDeck(await readFile(source, "utf8"));
            if (!result.ok || result.ignored) throw new Error("Invalid public deck: " + path);
          }
          paths.add(path);
        }
      }
    }
  }
}

// Both compiled entries use absolute URLs under the Pages prefix.
await mkdir(join(output, "importer"));
await rename(join(output, "index.html"), join(output, "importer", "index.html"));
await rename(join(output, "lite", "index.html"), join(output, "index.html"));
await rmdir(join(output, "lite"));
await copyFile("public/LUCIDE-LICENSE.txt", join(output, "LUCIDE-LICENSE.txt"));
for (const path of paths) {
  const target = join(output, path);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(join(publication, path), target);
}
console.log("Pages artifact: " + paths.size + " reviewed resources in dist-pages/");
