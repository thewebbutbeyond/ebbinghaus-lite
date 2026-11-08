import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { archive, root, password, sourceBytes, unlock } from "../archive-fixture.ts";
import { archiveStorageKey } from "../../src/archive-access.ts";

const department = root + "#/he2b/esi";
const cyber = department + "/introduction-a-la-cybersecurite";
const sheet = "cours/algo/Formulaire-Methodes-Chapitres-1-7.pdf";

test("a fresh direct link shows its gate without waiting for the encrypted archive", async ({ page }) => {
  const downloads: string[] = [];
  await page.route("**/archives/he2b-esi.enc.json", route => {
    downloads.push(route.request().url());
    return route.abort();
  });
  await page.goto(cyber);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Accéder à l’archive");
  await expect(page.getByLabel("Mot de passe", { exact: true })).toBeVisible();
  expect(downloads).toEqual([]);
});

test("public navigation leads to the archive gate, which rejects a wrong password and accepts keyboard login", async ({ page }, info) => {
  const errors: string[] = [];
  const posts: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => { if (request.postData()) posts.push(request.postData()!); });
  await page.goto(root + "#/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Institutions");
  await page.getByRole("link", { name: "Ouvrir — HE2B", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("HE2B");
  await page.getByRole("link", { name: "Ouvrir — ESI", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Accéder à l’archive");
  await expect(page).toHaveURL(new RegExp(department + "$"));
  const input = page.getByLabel("Mot de passe", { exact: true });
  await expect(input).toHaveAttribute("type", "password");
  await expect(page.getByRole("link", { name: "Ouvrir — Algorithmique I", exact: true })).toHaveCount(0);
  await expect(page.locator("#lite-back")).toHaveText("HE2B");
  await input.fill("a-wrong-password-on-purpose");
  await input.press("Enter");
  await expect(page.getByRole("alert")).toHaveText("Mot de passe incorrect.");
  await expect(input).toBeFocused();
  await expect(input).toHaveAttribute("aria-invalid", "true");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await mkdir(".omx/archive-access/screenshots", { recursive: true });
  await page.screenshot({ path: ".omx/archive-access/screenshots/gate-" + info.project.name + ".png", fullPage: true });
  await input.fill(password);
  await input.press("Enter");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("ESI");
  await expect(page.getByRole("link", { name: "Ouvrir — Algorithmique I", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ouvrir — Introduction à la cybersécurité", exact: true })).toBeVisible();
  expect(await page.evaluate(() => Object.values(sessionStorage).includes(document.querySelector<HTMLInputElement>('input[type="password"]')?.value ?? ""))).toBe(false);
  const storage = await page.evaluate(() => ({ session: { ...sessionStorage }, local: { ...localStorage } }));
  expect(JSON.stringify(storage)).not.toContain(password);
  expect(Object.keys(storage.session).filter(key => key.startsWith("ebbinghaus-lite:archive:"))).toHaveLength(1);
  expect(posts).toEqual([]);
  expect(errors).toEqual([]);
});

test("direct course, deck, simulation and invalid course links all require the archive password", async ({ page }) => {
  for (const path of [department, cyber, cyber + "/paquets/introduction", cyber + "/simulations/ddos", department + "/inconnu"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Accéder à l’archive");
    await expect(page.locator(".question-text, .ddos-view, .portal-section")).toHaveCount(0);
  }
  await page.goto(cyber + "/simulations/ddos");
  await unlock(page);
  await expect(page.locator("[data-ddos-time]")).toHaveText("0 s");
  await page.locator("#lite-back").click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Introduction à la cybersécurité");
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Introduction à la cybersécurité");
  await page.locator("#lite-back").click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("ESI");
  await page.goBack();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Introduction à la cybersécurité");

  const stranger = await page.context().browser()!.newContext();
  try {
    const strangerPage = await stranger.newPage();
    await strangerPage.goto(new URL(cyber, page.url()).href);
    await expect(strangerPage.getByRole("heading", { level: 1 })).toHaveText("Accéder à l’archive");
  } finally { await stranger.close(); }
});

test("an unlock works without browser storage, and unavailable archives fail closed", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "sessionStorage", { get() { throw new Error("Storage disabled"); } });
  });
  await page.goto(cyber);
  await unlock(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Introduction à la cybersécurité");
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Accéder à l’archive");
  // Use a fresh page so its encrypted bundle request can be intercepted.
  const unavailable = await page.context().newPage();
  try {
    await unavailable.route("**/archives/he2b-esi.enc.json", route => route.fulfill({ status: 503, body: "Unavailable" }));
    await unavailable.goto(cyber);
    await unavailable.getByLabel("Mot de passe", { exact: true }).fill(password);
    await unavailable.getByRole("button", { name: "Accéder", exact: true }).click();
    await expect(unavailable.getByRole("alert")).toHaveText("Impossible d’ouvrir l’archive. Réessaie.");
    await expect(unavailable.getByRole("heading", { level: 1 })).toHaveText("Accéder à l’archive");
    await unavailable.unroute("**/archives/he2b-esi.enc.json");
    await unlock(unavailable);
    await expect(unavailable.getByRole("heading", { level: 1 })).toHaveText("Introduction à la cybersécurité");
  } finally { await unavailable.close(); }
});

test("an invalid remembered key is discarded and a modified encrypted bundle never unlocks", async ({ page }) => {
  const storageKey = archiveStorageKey(archive.id, archive.salt);
  await page.addInitScript(key => sessionStorage.setItem(key, "0".repeat(64)), storageKey);
  await page.goto(cyber);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Accéder à l’archive");
  expect(await page.evaluate(key => sessionStorage.getItem(key), storageKey)).toBe(null);
  await unlock(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Introduction à la cybersécurité");

  const corrupted = await page.context().newPage();
  try {
    await corrupted.route("**/archives/he2b-esi.enc.json", route => route.fulfill({ json: {
      ...archive, data: (archive.data[0] === "0" ? "1" : "0") + archive.data.slice(1),
    } }));
    await corrupted.goto(cyber);
    await corrupted.getByLabel("Mot de passe", { exact: true }).fill(password);
    await corrupted.getByRole("button", { name: "Accéder", exact: true }).click();
    await expect(corrupted.getByRole("alert")).toHaveText("Mot de passe incorrect.");
    await expect(corrupted.locator(".portal-section")).toHaveCount(0);
  } finally { await corrupted.close(); }
});

test("password gate leaves private file URLs unavailable and decrypts a PDF locally after access", async ({ page, request }) => {
  expect((await request.get(root + sheet)).status()).toBe(404);
  const payload = await request.get(root + "archives/he2b-esi.enc.json");
  expect(payload.ok()).toBe(true);
  const text = await payload.text();
  expect(text).not.toContain(password);
  expect(text).not.toContain(sourceBytes(sheet).toString("base64"));
  await page.goto(department + "/algorithmique-i");
  await unlock(page);
  const link = page.getByRole("link", { name: "Télécharger — Algorithmique I · Formulaire et méthodes", exact: true });
  const href = await link.getAttribute("href");
  expect(href).toMatch(/^blob:/);
  const bytes = await page.evaluate(async url => [...new Uint8Array(await (await fetch(url!)).arrayBuffer())], href);
  expect(Buffer.from(bytes)).toEqual(sourceBytes(sheet));
});
