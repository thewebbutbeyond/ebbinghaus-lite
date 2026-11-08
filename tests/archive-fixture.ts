import { readFile } from "node:fs/promises";
import { expect, type Page } from "@playwright/test";
import { decryptArchive, deriveArchiveKey, fileBytes, parseEncryptedArchive } from "../src/archive.ts";
import { archiveStorageKey } from "../src/archive-access.ts";
import { archivePassword } from "../scripts/archive-password.ts";

export const root = "/ebbinghaus-lite/";
export const archive = parseEncryptedArchive(JSON.parse(await readFile("publication/archives/he2b-esi.enc.json", "utf8")), "he2b-esi");
export const password = archivePassword();
const key = await deriveArchiveKey(password, archive.salt);
export const contents = await decryptArchive(archive, key);

export function sourceBytes(path: string): Buffer {
  const file = contents.files[path];
  if (!file) throw new Error("Missing test resource");
  return Buffer.from(fileBytes(file));
}

// Existing simulation/library checks start with an authorized tab. Separate
// archive tests exercise the real password form and unauthenticated contexts.
export async function authorizeTab(page: Page): Promise<void> {
  await page.addInitScript(({ storageKey, key }) => {
    sessionStorage.setItem(storageKey, key);
  }, { storageKey: archiveStorageKey(archive.id, archive.salt), key });
}

export async function unlock(page: Page): Promise<void> {
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Accéder à l’archive");
  await page.getByLabel("Mot de passe", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Accéder", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Accéder à l’archive", exact: true })).toHaveCount(0);
}
