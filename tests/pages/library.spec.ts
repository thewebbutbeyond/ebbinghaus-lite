import { expect, test, type Locator } from "@playwright/test";
import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { archive, authorizeTab, contents, password, sourceBytes } from "../archive-fixture.ts";

const root = "/ebbinghaus-lite/";
const esi = root + "#/he2b/esi";
const algo = esi + "/algorithmique-i";
const cyber = esi + "/introduction-a-la-cybersecurite";
const introduction = cyber + "/paquets/introduction";
const introSource = "cours/secu/00-introduction.json";
const sheetPath = "cours/algo/Formulaire-Methodes-Chapitres-1-7.pdf";
const correctionPath = "cours/algo/Corrige-Chapitre-2.pdf";

test.beforeEach(async ({ page }, info) => {
  if (!info.title.startsWith("the separate importer")) await authorizeTab(page);
});

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
    (url.startsWith("blob:") || new URL(url).pathname.startsWith(root)) && !new URL(url).pathname.includes("/api/"))).toBe(true);
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
  await expect(page.getByRole("heading", { name: "Formulaire et méthodes", exact: true })).toBeVisible();
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
  await expect(page.getByRole("heading", { name: "Formulaire et méthodes", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Corrigés" })).toBeVisible();
  await expect(page.locator("time")).toHaveAttribute("datetime", /^\d{4}-\d{2}-\d{2}$/);
  await expect(page.getByText(/^Dernière mise à jour :/)).toBeVisible();
  await expect(page.getByText(/fichier daté|examen à confirmer|révision complète/i)).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Ouvrir — Introduction à la cybersécurité · Flashcards", exact: true }))
    .toHaveAttribute("href", /\/paquets\/revision-complete$/);
  await expect(page.getByRole("link", { name: "Ouvrir dans un nouvel onglet — Examen · juin 2025 · Série A" }))
    .toHaveAttribute("href", /^blob:/);
  await expect(page.getByRole("link", { name: "Ouvrir dans un nouvel onglet — Examen · janvier 2026 · Série A" }))
    .toHaveAttribute("href", /^blob:/);
  await page.getByRole("link", { name: /^ebbinghaus lite/ }).click();
  await expect(heading).toHaveText("Révise tes cours");

  // Open a bookmarked course without first traversing the catalogue.
  const bookmark = await page.context().newPage();
  await authorizeTab(bookmark);
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

test("corrections group chapters separately and assessments by type then month across years", async ({ page }) => {
  await page.goto(algo);
  const corrections = page.locator("section.portal-section").filter({ has: page.getByRole("heading", { name: "Corrigés", exact: true }) });
  await expect(corrections.locator("h3")).toHaveText(["Chapitres", "Bilans"]);
  await expect(corrections.locator('[data-correction-kind="chapter"] .portal-resource-name')).toHaveCount(7);
  const bilans = corrections.locator('[data-correction-kind="bilan"]');
  await expect(bilans.locator("h4")).toHaveText(["Novembre"]);
  await expect(bilans.locator('[data-month="11"] .portal-resource-name')).toHaveText([
    "Bilan · novembre 2023", "Bilan · novembre 2024", "Bilan · novembre 2025",
  ]);
  await expect(corrections.getByRole("link", { name: /^Ouvrir dans un nouvel onglet/ })).toHaveCount(10);
  await page.goto(cyber);
  await expect(corrections.locator("h3")).toHaveText(["Examens"]);
  await expect(corrections.locator("h4")).toHaveText(["Janvier", "Juin", "Septembre"]);
  await expect(corrections.locator('[data-month="1"] .portal-resource-name')).toHaveText([
    "Examen · janvier 2024", "Examen · janvier 2025 · Série B", "Examen · janvier 2026 · Série A",
  ]);
  await expect(corrections.locator('[data-month="6"] .portal-resource-name')).toHaveText(["Examen · juin 2025 · Série A"]);
  await expect(corrections.locator('[data-month="9"] .portal-resource-name')).toHaveText(["Examen · septembre 2025 · Série A"]);
  const links = corrections.getByRole("link", { name: /^Ouvrir dans un nouvel onglet/ });
  await expect(links).toHaveCount(5);
  for (const link of await links.all()) await expect(link).toHaveAttribute("href", /^blob:/);
});

test("a thin separator distinguishes the complete flashcard deck from chapter decks", async ({ page }) => {
  await page.goto(cyber);
  const flashcards = page.locator("section.portal-section").filter({ has: page.getByRole("heading", { name: "Flashcards", exact: true }) });
  await expect(flashcards).toBeVisible();
  expect(await flashcards.locator(":scope > *").evaluateAll(elements => elements.map(element => element.tagName)))
    .toEqual(["H2", "UL", "HR", "UL"]);
  await expect(flashcards.locator("ul").first().locator(".portal-resource-name")).toHaveText(["Introduction à la cybersécurité · Flashcards"]);
  await expect(flashcards.locator("ul").last().locator(".portal-resource-name")).toHaveText([
    "Chapitre 0 · Introduction", "Chapitre 1 · Objectifs et principes", "Chapitre 2 · Outils cryptographiques",
    "Chapitre 3 · Échange de clés", "Chapitre 4 · Authentification", "Chapitre 5 · Sécurité réseau",
  ]);
  const divider = flashcards.getByRole("separator");
  await expect(divider).toBeVisible();
  expect(await divider.evaluate(element => getComputedStyle(element).borderTopWidth)).toBe("1px");
  await page.goto(algo);
  await expect(page.getByRole("separator")).toHaveCount(0);
});

test("a published deck uses the shared review flow and keeps its back control", async ({ page }) => {
  const cards: { question: string; answer: string }[] =
    JSON.parse(sourceBytes(introSource).toString("utf8"));
  expect(cards.length).toBeGreaterThan(1);
  const browserErrors: string[] = [];
  const urls: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("request", (request) => urls.push(request.url()));
  await page.goto(cyber);
  const back = page.locator("#lite-back");
  const position = await corner(back);
  await page.getByRole("link", { name: "Ouvrir — Chapitre 0 · Introduction", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(introduction + "$"));
  await expect(back).toHaveText("Retour au cours");
  const stable = async () => {
    expect(await corner(back)).toEqual(position);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  };
  await stable();
  const deckTitle = page.locator(".filename");
  await expect(deckTitle).toHaveText("Chapitre 0 · Introduction");
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
    (url.startsWith("blob:") || new URL(url).pathname.startsWith(root)) && !new URL(url).pathname.includes("/api/"))).toBe(true);
});

test("PDFs open in a new tab and download with their published bytes", async ({ page }) => {
  await page.goto(algo);
  for (const [section, path] of [["Formulaire et méthodes", sheetPath], ["Corrigés", correctionPath]] as const) {
    const sectionLocator = page.locator("section.portal-section").filter({
      has: page.getByRole("heading", { name: section }),
    });
    const filename = path.split("/").at(-1)!;
    const downloadLink = sectionLocator.locator('a[download="' + filename + '"]');
    const url = await downloadLink.getAttribute("href");
    expect(url).toMatch(/^blob:/);
    const open = sectionLocator.locator('a[target="_blank"][href="' + url + '"]');
    const document = await page.evaluate(async (url) => {
      const response = await fetch(url!);
      return { type: response.headers.get("Content-Type"), bytes: [...new Uint8Array(await response.arrayBuffer())] };
    }, url);
    expect(document.type).toBe("application/pdf");
    expect(Buffer.from(document.bytes)).toEqual(sourceBytes(path));
    const popup = page.waitForEvent("popup");
    await open.click();
    const opened = await popup;
    await expect(opened).toHaveURL(url!);
    await opened.close();
    const download = page.waitForEvent("download");
    await downloadLink.click();
    const result = await download;
    expect(result.suggestedFilename()).toBe(path.split("/").at(-1));
    expect(await readFile((await result.path())!)).toEqual(sourceBytes(path));
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

test("the Pages artifact contains only encrypted course files and no private entry point", async ({ request }, info) => {
  test.skip(info.project.name !== "desktop", "The artifact and server paths are identical on mobile.");
  const reviewed = Object.keys(contents.files).sort();
  expect(reviewed.filter((file) => file.endsWith(".pdf"))).toHaveLength(17);
  expect(reviewed.filter((file) => file.endsWith(".json"))).toHaveLength(7);
  const entries = await readdir("dist-pages", { recursive: true, withFileTypes: true });
  const files = entries.filter((entry) => !entry.isDirectory()).map((entry) =>
    join(entry.parentPath, entry.name).slice("dist-pages/".length)).sort();
  expect(entries.every((entry) => entry.isDirectory() || entry.isFile())).toBe(true);
  expect(files.filter((file) => file.startsWith("cours/") || /\.(pdf|map)$/.test(file))).toEqual([]);
  expect(files.filter((file) => !/^assets\/[\w.-]+\.(js|css)$/.test(file)))
    .toEqual(["LUCIDE-LICENSE.txt", "STATICRYPT-LICENSE.txt", "archives/he2b-esi.enc.json", "importer/index.html", "index.html"]);
  const encryptedResponse = await request.get(root + "archives/he2b-esi.enc.json");
  expect(await encryptedResponse.json()).toEqual(archive);
  for (const file of reviewed) {
    const response = await request.get(root + file);
    expect(response.status(), file).toBe(404);
  }
  for (const file of files) expect((await readFile(join("dist-pages", file), "utf8")).includes(password), file).toBe(false);
  for (const file of files.filter((path) => /\.(js|html|css)$/.test(path))) {
    const source = await readFile(join("dist-pages", file), "utf8");
    expect(source).not.toMatch(/\/api\/(courses|session)|passwordHash|\.portal-data\.local|alice@example\.test|balise violette/);
  }
  for (const path of ["/ebbinghaus-viewer/", "/api/session", root + "api/courses", root + "he2b/esi/",
    root + "portal/", root + "cours/", root + ".portal-data.local/manifest.json", root + ".omx/lite-pages.md",
    root + ".env.archive.local", root + ".archive-materials.local/" + sheetPath]) {
    expect((await request.get(path)).status(), path).toBe(404);
  }
});
