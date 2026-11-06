import { expect, test, type Locator } from "@playwright/test";
import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = "/ebbinghaus-lite/";
const esi = root + "#/he2b/esi";
const algo = esi + "/algorithmique-i";
const cyber = esi + "/introduction-a-la-cybersecurite";
const introduction = cyber + "/paquets/introduction";
const introSource = "cours/secu/00-introduction.json";
const sheetPath = "cours/algo/Formulaire-Methodes-Chapitres-1-7.pdf";
const correctionPath = "cours/algo/Corrige-Chapitre-2.pdf";

async function corner(locator: Locator): Promise<{ x: number; y: number }> {
  await expect(locator).toBeVisible();
  return locator.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return { x: box.left + scrollX, y: box.top + scrollY };
  });
}

test("the welcome page previews a card without leaving and links to the catalogue", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.goto(root);
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toHaveText("Révise tes cours");
  await expect(page.getByText(/Accès libre, sans compte|Dans la bibliothèque|Importer des cartes/)).toHaveCount(0);
  const preview = page.getByRole("region", { name: "Aperçu de la bibliothèque" });
  await expect(preview).toBeVisible();
  await expect(preview.getByText("ebbinghaus lite", { exact: true })).toBeVisible();
  await expect(preview.getByRole("link")).toHaveCount(0);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const homeUrl = page.url();
  const answer = preview.getByText("Pendant leur transmission et pendant leur stockage.");
  await expect(answer).toBeHidden();
  const reveal = preview.locator("summary");
  await reveal.focus();
  await page.keyboard.press("Enter");
  await expect(answer).toBeVisible();
  await expect(page).toHaveURL(homeUrl);
  await reveal.click();
  await expect(answer).toBeHidden();

  await page.getByRole("link", { name: "Voir les cours" }).click();
  await expect(heading).toHaveText("Institutions");
  await page.goBack();
  await expect(heading).toHaveText("Révise tes cours");
  await page.goto(introduction);
  await expect(page.getByRole("button", { name: "Non" })).toBeVisible();
  await page.getByRole("link", { name: "ebbinghaus lite — Accueil" }).click();
  await expect(heading).toHaveText("Révise tes cours");
  await expect(page).toHaveURL(homeUrl);
  const origin = new URL(page.url()).origin;
  expect(requests.every((url) => new URL(url).origin === origin &&
    new URL(url).pathname.startsWith(root) && !new URL(url).pathname.includes("/api/"))).toBe(true);
});

test("institutions, breadcrumbs, reload, browser back, and both courses", async ({ page }, info) => {
  await page.goto(root + "#/");
  const heading = page.getByRole("heading", { level: 1 });
  const breadcrumbs = page.getByRole("navigation", { name: "Fil d’Ariane" });
  await expect(heading).toHaveText("Institutions");
  await expect(page.getByRole("link", { name: "Ouvrir — HE2B" })).toBeVisible();
  await page.getByRole("link", { name: "Ouvrir — HE2B" }).click();
  await expect(heading).toHaveText("HE2B");
  await page.getByRole("link", { name: "Ouvrir — ESI" }).click();
  await expect(heading).toHaveText("ESI");
  await expect(page).toHaveURL(new RegExp(esi + "$"));
  await page.getByRole("link", { name: "Ouvrir — Algorithmique I" }).click();
  await expect(page).toHaveURL(new RegExp(algo + "$"));
  await expect(heading).toHaveText("Algorithmique I");
  await expect(page.getByRole("heading", { name: "Flashcards" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Formulaire et méthode" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Corrigés" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sujets et corrigés" })).toHaveCount(0);
  await expect(page.locator("time")).toHaveAttribute("datetime", /^\d{4}-\d{2}-\d{2}$/);
  await expect(page.getByText(/^Dernière mise à jour :/)).toBeVisible();
  await expect(page.getByText(/correspondance avec le programme/)).toHaveCount(0);
  if (info.project.name === "desktop") {
    await expect(breadcrumbs.getByRole("link")).toHaveText(["Institutions", "HE2B", "ESI"]);
    await expect(breadcrumbs.locator('[aria-current="page"]')).toHaveText("Algorithmique I");
  } else await expect(breadcrumbs).toBeHidden();
  await expect(page.locator("#lite-back")).toHaveText("ESI");
  await expect(page.getByRole("link", { name: /^ebbinghaus lite/ })).toHaveText("ebbinghaus lite");
  await expect(page.getByText(/Importer un paquet|Se connecter|Se déconnecter/)).toHaveCount(0);
  await page.reload();
  await expect(heading).toHaveText("Algorithmique I");
  await page.goBack();
  await expect(heading).toHaveText("ESI");
  await page.getByRole("link", { name: "Ouvrir — Introduction à la cybersécurité" }).click();
  await expect(heading).toHaveText("Introduction à la cybersécurité");
  await expect(page.getByRole("heading", { name: "Flashcards" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Formulaire et méthode" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Corrigés" })).toBeVisible();
  await expect(page.locator("time")).toHaveAttribute("datetime", /^\d{4}-\d{2}-\d{2}$/);
  await expect(page.getByText(/^Dernière mise à jour :/)).toBeVisible();
  await expect(page.getByText(/fichier daté|examen à confirmer|révision complète/i)).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Ouvrir — Introduction à la cybersécurité", exact: true }))
    .toHaveAttribute("href", /\/paquets\/revision-complete$/);
  await expect(page.getByRole("link", { name: "Ouvrir dans un nouvel onglet — Juin 2025 · Série A" }))
    .toHaveAttribute("href", /Corrige-Examen-2025-06-13\.pdf$/);
  await expect(page.getByRole("link", { name: "Ouvrir dans un nouvel onglet — Janvier 2026 · Série A" }))
    .toHaveAttribute("href", /Corrige-Examen-2026-01-23-a\.pdf$/);
  await page.getByRole("link", { name: /^ebbinghaus lite/ }).click();
  await expect(heading).toHaveText("Révise tes cours");

  // Open a bookmarked course without first traversing the catalogue.
  const bookmark = await page.context().newPage();
  await bookmark.goto(cyber);
  await expect(bookmark.getByRole("heading", { level: 1 })).toHaveText("Introduction à la cybersécurité");
  await bookmark.reload();
  await expect(bookmark.getByRole("heading", { level: 1 })).toHaveText("Introduction à la cybersécurité");
  await bookmark.goto(root + "#/he2b/esi/inconnu");
  await expect(bookmark.getByRole("heading", { level: 1 })).toHaveText("Page introuvable");
  await bookmark.locator("#lite-back").click();
  await expect(bookmark.getByRole("heading", { level: 1 })).toHaveText("ESI");
  await bookmark.close();
});

test("a published deck uses the shared review flow and keeps its back control", async ({ page }) => {
  const cards: { question: string; answer: string }[] =
    JSON.parse(await readFile(join("publication", introSource), "utf8"));
  expect(cards.length).toBeGreaterThan(1);
  const browserErrors: string[] = [];
  const urls: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("request", (request) => urls.push(request.url()));
  await page.goto(cyber);
  const back = page.locator("#lite-back");
  const position = await corner(back);
  const publishedResponse = page.waitForResponse((response) => new URL(response.url()).pathname === root + introSource);
  await page.getByRole("link", { name: /^Ouvrir — .*Introduction$/ }).click();
  await expect(page).toHaveURL(new RegExp(introduction + "$"));
  expect((await publishedResponse).ok()).toBe(true);
  await expect(back).toHaveText("Retour au cours");
  const stable = async () => {
    expect(await corner(back)).toEqual(position);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  };
  await stable();
  const deckTitle = page.locator(".filename");
  await expect(deckTitle).toHaveText(/Introduction$/);
  expect((await corner(deckTitle)).y).toBeGreaterThan(position.y);
  await page.getByRole("button", { name: "Non" }).click();
  await stable();
  for (const [index, card] of cards.entries()) {
    await expect(page.locator(".question-text")).toHaveText(card.question, { useInnerText: true });
    await page.getByRole("button", { name: /Révéler la réponse/ }).click();
    await expect(page.locator(".answer-text")).toHaveText(card.answer, { useInnerText: true });
    if (!index) await stable();
    await page.getByRole("button", { name: "J’ai trouvé" }).click();
  }
  await expect(page.getByRole("heading", { name: "Paquet terminé" })).toBeVisible();
  await stable();
  await expect(page.getByRole("button", { name: "Importer un paquet" })).toHaveCount(0);
  await back.click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Introduction à la cybersécurité");
  await page.goBack();
  await expect(page.getByRole("button", { name: "Non" })).toBeVisible();
  expect(browserErrors).toEqual([]);
  expect(urls.length).toBeGreaterThan(1);
  const origin = new URL(page.url()).origin;
  expect(urls.every((url) => new URL(url).origin === origin &&
    new URL(url).pathname.startsWith(root) && !new URL(url).pathname.includes("/api/"))).toBe(true);
});

test("PDFs open in a new tab and download with their published bytes", async ({ page }) => {
  await page.goto(algo);
  for (const [section, path] of [["Formulaire et méthode", sheetPath], ["Corrigés", correctionPath]] as const) {
    const sectionLocator = page.locator("section.portal-section").filter({
      has: page.getByRole("heading", { name: section }),
    });
    const url = new URL(root + path, page.url()).href;
    const open = sectionLocator.locator('a[target="_blank"][href="' + root + path + '"]');
    const inline = page.context().waitForEvent("response", { predicate: (response) => response.url() === url });
    const popup = page.waitForEvent("popup");
    await open.click();
    const [opened, response] = await Promise.all([popup, inline]);
    expect(response.ok()).toBe(true);
    expect(response.headers()["content-type"]).toMatch(/^application\/pdf/);
    await opened.close();
    const download = page.waitForEvent("download");
    await sectionLocator.locator('a[download][href="' + root + path + '"]').click();
    const result = await download;
    expect(result.suggestedFilename()).toBe(path.split("/").at(-1));
    expect(await readFile((await result.path())!)).toEqual(await readFile(join("publication", path)));
  }
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Algorithmique I");
});

test("the separate importer still reads a local deck without an upload", async ({ page }) => {
  const urls: string[] = [];
  page.on("request", (request) => urls.push(request.url()));
  await page.goto(root + "importer/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ebbinghaus Viewer");
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Importer tes cartes" }).click();
  await (await chooser).setFiles(resolve("examples/paquet-fictif.json"));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("paquet-fictif.json");
  await page.getByRole("button", { name: "Non" }).click();
  await page.getByRole("button", { name: /Révéler la réponse/ }).click();
  await expect(page.getByRole("region", { name: "Réponse" })).toBeVisible();
  const origin = new URL(page.url()).origin;
  expect(urls.every((url) => new URL(url).origin === origin &&
    /^\/ebbinghaus-lite\/(?:importer\/|assets\/[^/]+)$/.test(new URL(url).pathname))).toBe(true);
});

test("the Pages artifact contains exactly the reviewed file set and no private entry point", async ({ request }, info) => {
  test.skip(info.project.name !== "desktop", "The artifact and server paths are identical on mobile.");
  const publishedIndex = await readFile("publication/cours/index.html", "utf8");
  const reviewed = Array.from(publishedIndex.matchAll(/href="\.\/(algo|secu)\/([^"]+\.(?:pdf|json))"/g),
    (match) => "cours/" + match[1] + "/" + match[2]).sort();
  expect(reviewed.filter((file) => file.endsWith(".pdf"))).toHaveLength(17);
  expect(reviewed.filter((file) => file.endsWith(".json"))).toHaveLength(7);
  const entries = await readdir("dist-pages", { recursive: true, withFileTypes: true });
  const files = entries.filter((entry) => !entry.isDirectory()).map((entry) =>
    join(entry.parentPath, entry.name).slice("dist-pages/".length)).sort();
  expect(entries.every((entry) => entry.isDirectory() || entry.isFile())).toBe(true);
  expect(files.filter((file) => file.startsWith("cours/"))).toEqual(reviewed);
  expect(files.filter((file) => !file.startsWith("cours/") && !/^assets\/[\w.-]+\.(js|css)$/.test(file)))
    .toEqual(["LUCIDE-LICENSE.txt", "importer/index.html", "index.html"]);
  for (const file of reviewed) {
    const response = await request.get(root + file);
    expect(response.ok(), file).toBe(true);
    expect(await response.body(), file).toEqual(await readFile(join("publication", file)));
  }
  for (const file of files.filter((path) => /\.(js|html|css)$/.test(path))) {
    const source = await readFile(join("dist-pages", file), "utf8");
    expect(source).not.toMatch(/\/api\/(courses|session)|passwordHash|\.portal-data\.local|alice@example\.test|balise violette/);
  }
  for (const path of ["/ebbinghaus-viewer/", "/api/session", root + "api/courses", root + "he2b/esi/",
    root + "portal/", root + "cours/", root + ".portal-data.local/manifest.json", root + ".omx/lite-pages.md"]) {
    expect((await request.get(path)).status(), path).toBe(404);
  }
});
