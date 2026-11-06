import { expect, test, type Locator, type Page } from "@playwright/test";
import { once } from "node:events";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createDemoData, deckTitle, demoTitle, otherTitle, sheetFile, sheetTitle } from "../../server/demo.ts";
import { createPortalServer } from "../../server/http.ts";
import { STORAGE_KEY } from "../../src/storage.ts";

let root: string;
let dataDir: string;
let server: Server;
let origin: string;
let students: Awaited<ReturnType<typeof createDemoData>>;

test.beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "ebbinghaus-browser-"));
  dataDir = join(root, "private");
  students = await createDemoData(dataDir);
  server = await createPortalServer({ dataDir, distDir: resolve("dist-portal") });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing local server address");
  origin = "http://127.0.0.1:" + address.port;
});

test.afterAll(async () => {
  if (server?.listening) await new Promise<void>((resolve, reject) =>
    server.close((error) => error ? reject(error) : resolve()));
  if (root) await rm(root, { recursive: true, force: true });
});

async function signIn(page: Page, index: number): Promise<void> {
  const { email, password } = students[index]!;
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
}

async function position(locator: Locator): Promise<{ x: number; y: number; bottom: number }> {
  await expect(locator).toBeVisible();
  return locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { x: rect.left + scrollX, y: rect.top + scrollY, bottom: rect.bottom + scrollY };
  });
}

test("public build is standalone and neither build embeds private materials", async () => {
  for (const build of ["dist", "dist-portal"]) {
    const files = await readdir(build, { recursive: true });
    expect(files).not.toContain("manifest.json");
    expect(files.some((file) => /\.(pdf|json)$/.test(file))).toBe(false);
    expect(files.includes(join("portal", "index.html"))).toBe(build === "dist-portal");
    for (const file of files.filter((name) => /\.(js|html|css)$/.test(name))) {
      const text = await readFile(join(build, file), "utf8");
      expect(text).not.toMatch(/passwordHash|Que signale la balise violette|alice@example\.test|Fiche de navigation aérienne/);
      if (build === "dist") expect(text).not.toMatch(/\/api\/session|\/api\/courses/);
    }
  }
});

test("student reviews a published deck and opens and downloads distinct multipage PDFs", async ({ page }) => {
  await page.goto(origin + "/portal/");
  const brand = page.getByRole("link", { name: /^ebbinghaus lite/ });
  const importer = page.getByText("Importer un paquet", { exact: true });
  const dashboardHeading = page.getByRole("heading", { name: "Mes cours" });
  const courseHeading = page.getByRole("heading", { name: demoTitle });
  const courseBack = page.getByRole("link", { name: "Mes cours", exact: true });
  const deckBack = page.getByRole("link", { name: "Retour au cours", exact: true });
  const courseLink = page.getByRole("link", { name: "Ouvrir — " + demoTitle });
  const deckLink = page.getByRole("link", { name: "Ouvrir — " + deckTitle });
  await expect(brand).toHaveText("ebbinghaus lite");
  await expect(page.getByRole("heading", { name: "Connexion" })).toHaveCSS("text-align", "center");
  await expect(importer).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Se déconnecter" })).toBeHidden();
  await signIn(page, 0);
  await expect(dashboardHeading).toHaveCSS("text-align", "center");
  await expect(brand).toHaveText("ebbinghaus lite");
  await expect(importer).toHaveCount(0);
  await expect(courseBack).toHaveCount(0);
  await expect(page.getByText(demoTitle, { exact: true })).toHaveCSS("text-align", /^(start|left)$/);
  await expect(page.getByText(otherTitle, { exact: true })).toHaveCount(0);
  await expect(courseLink).toHaveText("Ouvrir");
  await courseLink.click();
  await expect(courseHeading).toHaveCSS("text-align", /^(start|left)$/);
  await expect(importer).toHaveCount(0);
  const courseBackPosition = await position(courseBack);
  expect(courseBackPosition.y).toBeGreaterThanOrEqual((await position(page.getByRole("banner"))).bottom);
  expect(courseBackPosition.bottom).toBeLessThan((await position(courseHeading)).y);
  await courseBack.click();
  await expect(dashboardHeading).toBeVisible();
  await courseLink.click();
  await brand.click();
  await expect(dashboardHeading).toBeVisible();
  await courseLink.click();
  await expect(deckLink).toHaveText("Ouvrir");
  await deckLink.click();

  async function checkDeckNavigation(): Promise<void> {
    const backPosition = await position(deckBack);
    expect(backPosition).toEqual(courseBackPosition);
    expect(backPosition.bottom).toBeLessThan((await position(page.getByText(deckTitle, { exact: true }))).y);
    await expect(page.getByRole("button", { name: "Retour au cours" })).toHaveCount(0);
    await expect(importer).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  }
  await checkDeckNavigation();
  await page.getByRole("button", { name: "Non" }).click();
  await checkDeckNavigation();
  await page.getByRole("button", { name: /Révéler la réponse/ }).click();
  await checkDeckNavigation();
  await expect(page.getByText("Une aire d’amarrage libre.")).toBeVisible();
  await page.getByRole("button", { name: "À revoir" }).click();
  await expect(page.getByText("Quand vérifier le câble ?")).toBeVisible();
  await page.getByRole("button", { name: "Annuler" }).click();
  await expect(page.getByText("Une aire d’amarrage libre.")).toBeVisible();
  await page.getByRole("button", { name: "J’ai trouvé" }).click();
  await page.getByRole("button", { name: /Révéler la réponse/ }).click();
  await page.getByRole("button", { name: "J’ai trouvé" }).click();
  await expect(page.getByRole("heading", { name: "Paquet terminé" })).toBeVisible();
  await checkDeckNavigation();
  await deckBack.click();
  await expect(courseHeading).toBeVisible();

  const openSheet = page.getByRole("link", { name: "Ouvrir — " + sheetTitle });
  const sheetUrl = new URL((await openSheet.getAttribute("href"))!, origin).href;
  const opened = page.context().waitForEvent("response", { predicate: (response) => response.url() === sheetUrl });
  const popup = page.waitForEvent("popup");
  await openSheet.click();
  const [newTab, inline] = await Promise.all([popup, opened]);
  expect(inline.status()).toBe(200);
  expect(inline.headers()["content-disposition"]).toMatch(/^inline;/);
  await newTab.close();
  const downloadLink = page.getByRole("link", { name: "Télécharger — " + sheetTitle });
  await expect(downloadLink).toHaveText("");
  await expect(downloadLink.locator("svg")).toBeVisible();
  const downloadEvent = page.waitForEvent("download");
  await downloadLink.click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe(sheetFile);
  const bytes = await readFile((await download.path())!);
  expect(bytes).toEqual(await readFile(join(dataDir, "supports", sheetFile)));
  expect(bytes.toString("ascii")).toMatch(/\/Count 2/);
  await expect(page.getByRole("heading", { name: demoTitle })).toBeVisible();

  const exercise = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: "Exercice 1" }) });
  for (const [label, filename] of [["Sujet", "Sujet 1.pdf"], ["Corrigé", "Corrigé 1.pdf"]]) {
    const href = await exercise.getByRole("link", { name: "Ouvrir — " + label }).getAttribute("href");
    expect(href).toBeTruthy();
    const response = await page.request.get(origin + href);
    expect(response.ok()).toBe(true);
    expect(await response.body()).toEqual(await readFile(join(dataDir, "supports", filename!)));
  }
  const workshop = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: "Atelier" }) });
  await expect(workshop.getByRole("link", { name: "Ouvrir — Sujet" })).toHaveCount(0);
  await expect(workshop.getByRole("link", { name: "Ouvrir — Corrigé" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
});

test("standalone keeps its snapshot, while a private refresh and sign-out never restore private card text", async ({ page }) => {
  await page.goto(origin + "/");
  await page.locator('input[type="file"]').setInputFiles({
    name: "local.json", mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify([{ question: "Question locale", answer: "Réponse locale" }])),
  });
  await expect(page.getByRole("heading", { name: "local.json" })).toBeVisible();
  const standalone = await page.evaluate((key) => sessionStorage.getItem(key), STORAGE_KEY);
  expect(standalone).toContain("Question locale");

  await page.goto(origin + "/portal/");
  await signIn(page, 0);
  await page.getByRole("link", { name: "Ouvrir — " + demoTitle }).click();
  await page.getByRole("link", { name: "Ouvrir — " + deckTitle }).click();
  const privateUrl = page.url();
  await page.getByRole("button", { name: "Non" }).click();
  await page.getByRole("button", { name: /Révéler la réponse/ }).click();
  await expect(page.getByText("Une aire d’amarrage libre.")).toBeVisible();
  const localState = await page.evaluate(() => ({
    session: { ...sessionStorage },
    local: { ...localStorage },
  }));
  expect(localState).toEqual({ session: { [STORAGE_KEY]: standalone }, local: {} });
  await page.reload();
  await expect(page.getByText("Veux-tu mélanger ton paquet ?")).toBeVisible();
  await expect(page.getByText("Une aire d’amarrage libre.")).toHaveCount(0);

  const sibling = await page.context().newPage();
  await sibling.goto(privateUrl);
  await sibling.getByRole("button", { name: "Non" }).click();
  await expect(sibling.getByText("Que signale la balise violette ?")).toBeVisible();
  const logout = page.getByRole("button", { name: "Se déconnecter", exact: true });
  await expect(logout).toHaveAttribute("title", "Se déconnecter");
  await expect(logout).toHaveText("Se déconnecter");
  await expect(logout.locator("svg:first-child")).toBeVisible();
  await expect(logout.locator("svg")).toHaveCSS("stroke", "oklch(0.58 0.2 25)");
  const header = await page.getByRole("banner").boundingBox();
  const button = await logout.boundingBox();
  expect(header).not.toBeNull();
  expect(button).not.toBeNull();
  expect(button!.x + button!.width).toBeCloseTo(header!.x + header!.width);
  expect(button!.y + button!.height).toBeLessThan(header!.y + header!.height);
  await page.getByRole("link", { name: /^ebbinghaus lite/ }).focus();
  await page.keyboard.press("Tab");
  await expect(logout).toBeFocused();
  await expect(logout).toHaveCSS("outline-style", "solid");
  await page.keyboard.press("Enter");
  await expect(sibling.getByRole("heading", { name: "Connexion" })).toBeVisible();
  await expect(sibling.getByText("Que signale la balise violette ?")).toHaveCount(0);
  await sibling.close();
  await expect(page.getByRole("heading", { name: "Connexion" })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Connexion" })).toBeVisible();
  await page.goto(privateUrl);
  await expect(page.getByRole("heading", { name: "Connexion" })).toBeVisible();
  await signIn(page, 1);
  await expect(page.getByRole("heading", { name: "Ressource indisponible" })).toBeVisible();
  await page.getByRole("link", { name: "Mes cours", exact: true }).click();
  await page.getByRole("link", { name: "Ouvrir — " + otherTitle }).click();
  await expect(page.getByText("Aucune ressource publiée pour ce cours.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Flashcards" })).toHaveCount(0);
  await page.goto(origin + "/");
  await expect(page.getByRole("heading", { name: "local.json" })).toBeVisible();
});
