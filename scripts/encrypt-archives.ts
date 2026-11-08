import { lstat, mkdir, readFile, realpath, rename, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { encryptArchive, type ArchiveFile } from "../src/archive.ts";
import { catalog } from "../src/lite-catalog.ts";
import { archivePassword } from "./archive-password.ts";

const password = archivePassword();
const sourceRoot = await realpath(".archive-materials.local");
await mkdir("publication/archives", { recursive: true });
for (const institution of catalog) {
  for (const department of institution.departments) {
    const files: Record<string, ArchiveFile> = {};
    for (const course of department.courses) {
      for (const resource of [...course.decks, ...course.sheets, ...course.corrections]) {
        if (!/^cours\/[a-z0-9-]+\/[A-Za-z0-9-]+\.(pdf|json)$/.test(resource.path) || files[resource.path]) {
          throw new Error("Invalid or duplicate archive resource: " + resource.path);
        }
        const source = join(sourceRoot, resource.path);
        if (!(await lstat(source)).isFile() || await realpath(source) !== source) throw new Error("Invalid archive source");
        files[resource.path] = {
          type: resource.path.endsWith(".pdf") ? "application/pdf" : "application/json",
          base64: (await readFile(source)).toString("base64"),
        };
      }
    }
    const archive = await encryptArchive({ version: 1, id: department.archive, files }, password);
    const destination = resolve("publication/archives", department.archive + ".enc.json");
    await writeFile(destination + ".tmp", JSON.stringify(archive) + "\n");
    await rename(destination + ".tmp", destination);
    console.log("Encrypted archive " + department.archive + ": " + Object.keys(files).length + " resources");
  }
}
