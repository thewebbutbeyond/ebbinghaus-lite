import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { authorizeTab, root, unlock } from "../archive-fixture.ts";

const course = root + "#/he2b/esi/introduction-a-la-cybersecurite";
const examples = [
  { id: "session-volee", title: "Chapitre 1 • Cookie de session volé", last: 6 },
  { id: "scytale", title: "Chapitre 1 • Scytale", last: 4 },
  { id: "phishing", title: "Chapitre 1 • Phishing", last: 5 },
] as const;
const counter = (page: Page) => page.locator("[data-example-step]");
const control = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
async function next(page: Page, count = 1): Promise<void> {
  for (let n = 0; n < count; n++) await control(page, "Suivant").click();
}

test("all three direct example links stay gated and unlock the originally requested view", async ({ page }) => {
  for (const example of examples) {
    const context = await page.context().browser()!.newContext();
    try {
      const fresh = await context.newPage();
      await fresh.goto(new URL(course + "/simulations/" + example.id, test.info().project.use.baseURL).href);
      await expect(fresh.getByRole("heading", { level: 1 })).toHaveText("Accéder à l’archive");
      await expect(fresh.locator("[data-example-step]")).toHaveCount(0);
      await unlock(fresh);
      await expect(fresh.getByRole("heading", { level: 1 })).toHaveText(example.title);
      await expect(counter(fresh)).toHaveText("Étape 0/" + example.last);
    } finally { await context.close(); }
  }
});

test("the course lists all four examples in course order and each route preserves navigation", async ({ page }, info) => {
  await authorizeTab(page);
  await page.goto(course);
  const section = page.locator(".portal-section").filter({ has: page.getByRole("heading", { name: "Exemples interactifs" }) });
  await expect(section.locator(".portal-resource-name")).toHaveText(["Chapitre 1 • Phishing", "Chapitre 1 • DDoS", "Chapitre 1 • Cookie de session volé", "Chapitre 1 • Scytale"]);
  const corner = () => page.locator("#lite-back").evaluate(element => {
    const rect = element.getBoundingClientRect();
    return { x: rect.left + scrollX, y: rect.top + scrollY };
  });
  const initial = await corner();
  for (const example of examples) {
    await page.getByRole("link", { name: "Ouvrir — " + example.title, exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(example.title);
    await expect(page).toHaveURL(new RegExp("/simulations/" + example.id + "$"));
    await expect(page.locator("#lite-back")).toHaveText("Retour au cours");
    if (info.project.name === "desktop") {
      await expect(page.locator('#lite-breadcrumbs [aria-current="page"]')).toHaveText(example.title);
    }
    await next(page, example.last);
    expect(await corner()).toEqual(initial);
    await expect(page.locator(".example-article")).toBeVisible();
    await expect(page.locator(".example-article details")).toHaveCount(0);
    await page.reload();
    await expect(counter(page)).toHaveText("Étape 0/" + example.last);
    await page.locator("#lite-back").click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Introduction à la cybersécurité");
    await page.goBack();
    await expect(counter(page)).toHaveText("Étape 0/" + example.last);
    await page.goForward();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Introduction à la cybersécurité");
  }
  await page.goto(course + "/simulations/scytale");
  await page.getByRole("link", { name: "ebbinghaus lite — Accueil", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Révise tes cours");
});

test("the stolen cookie trace keeps the password secret and resolves the copied session", async ({ page }) => {
  await authorizeTab(page);
  await page.goto(course + "/simulations/session-volee");
  const attacker = page.locator('[data-actor="attacker"]');
  await expect(attacker.locator("dd")).toHaveText(["Aucun", "Aucun", "Aucun"]);
  await next(page);
  await expect(page.getByRole("img", { name: /Utilisateur vers Serveur/ })).toContainText("mot-de-passe-fictif");
  await expect(attacker).not.toContainText("mot-de-passe-fictif");
  await next(page, 2);
  await expect(page.locator('[data-actor="user"] dd').last()).toHaveText("Alice");
  await expect(attacker.locator("dd")).toHaveText(["Aucun", "Aucun", "Aucun"]);
  await next(page);
  await expect(attacker.locator("dd")).toHaveText(["session-demo-7K4Q", "Aucun", "Aucun"]);
  await control(page, "Précédent").click();
  await expect(attacker.locator("dd")).toHaveText(["Aucun", "Aucun", "Aucun"]);
  await next(page, 3);
  await expect(attacker.locator("dd")).toHaveText(["session-demo-7K4Q", "Aucun", "Alice"]);
  await expect(page.locator('[data-actor="server"]')).toContainText("session-demo-7K4Q : Alice");
  await expect(control(page, "Suivant")).toBeDisabled();
  await expect(control(page, "Lire")).toBeDisabled();
  await control(page, "Recommencer").click();
  await expect(counter(page)).toHaveText("Étape 0/6");
  await expect(attacker.locator("dd")).toHaveText(["Aucun", "Aucun", "Aucun"]);
});

test("phishing discloses fictional credentials only after the separate submit event", async ({ page }) => {
  await authorizeTab(page);
  const requests: string[] = [];
  const posts: string[] = [];
  page.on("request", request => { requests.push(request.url()); if (request.postData()) posts.push(request.postData()!); });
  await page.goto(course + "/simulations/phishing");
  const attacker = page.locator('[data-actor="attacker"]');
  await next(page);
  await expect(attacker.locator("dd")).toHaveText(["Alice", "alice@campus-demo.test", "Aucun", "Aucun"]);
  await next(page);
  await expect(page.locator('[data-phishing-display="message"]')).toContainText("campus-demo.test/compte");
  await expect(page.locator('[data-phishing-display="message"]')).toContainText("https://campus-assistance.test/connexion");
  await expect(page.locator('[data-actor="victim"]')).toContainText("Pas encore reçu");
  await next(page);
  await expect(page.locator('.example-phases [aria-current="step"]')).toHaveText("3. Envoi du message");
  await next(page);
  await expect(page.locator('.example-phases [aria-current="step"]')).toHaveText("4. Tromperie et collecte");
  await expect(page.locator('[data-phishing-display="site"]')).toContainText("Ces identifiants n’ont pas encore été envoyés.");
  await expect(attacker.locator("dl > div:nth-child(n+3) dd")).toHaveText(["Aucun", "Aucun"]);
  await next(page);
  await expect(attacker.locator("dd")).toHaveText(["Alice", "alice@campus-demo.test", "alice-demo", "mot-de-passe-fictif"]);
  await control(page, "Précédent").click();
  await expect(attacker.locator("dl > div:nth-child(n+3) dd")).toHaveText(["Aucun", "Aucun"]);
  await expect(page.locator('.phishing-view input, .phishing-view form, a[href*=".test"]')).toHaveCount(0);
  expect(posts).toEqual([]);
  expect(requests.every(url => new URL(url).hostname !== "campus-assistance.test" && new URL(url).hostname !== "campus-demo.test")).toBe(true);
});

test("scytale computes the known permutation, preserves its tape and tracks individual letters", async ({ page }) => {
  await authorizeTab(page);
  await page.goto(course + "/simulations/scytale");
  await page.getByLabel("Message", { exact: true }).fill("ABCDEF");
  await page.getByLabel("Gabarit d’écriture", { exact: true }).selectOption("2");
  await page.getByLabel("Gabarit de lecture", { exact: true }).selectOption("2");
  await next(page, 4);
  const result = page.getByLabel("Message reconstitué", { exact: true });
  await expect(result).toHaveText("ABCDEF");
  const tape = page.locator('[data-scytale-part="tape"] button');
  await expect(tape).toHaveText(["A", "D", "B", "E", "C", "F"]);
  await tape.nth(1).click();
  await expect(page.locator('.scytale-cell[aria-pressed="true"]')).toHaveCount(4);
  await expect(page.locator('.scytale-cell[aria-pressed="true"]')).toHaveText(["D", "D", "D", "D"]);
  await page.getByLabel("Gabarit de lecture", { exact: true }).selectOption("3");
  await expect(result).toHaveText("AEDCBF");
  await expect(tape).toHaveText(["A", "D", "B", "E", "C", "F"]);
  await control(page, "Précédent").click();
  await expect(counter(page)).toHaveText("Étape 3/4");
  await expect(result).toHaveCount(0);
  await next(page);
  await expect(result).toHaveText("AEDCBF");
  await page.getByLabel("Message", { exact: true }).fill("ABCDE");
  await expect(counter(page)).toHaveText("Étape 0/4");
  await page.getByLabel("Gabarit de lecture", { exact: true }).selectOption("2");
  await next(page, 4);
  await expect(result).toHaveText("ABCDE");
  await expect(page.locator('[data-scytale-part="tape"] [data-padding="original"]')).toHaveCount(1);
});

test("scytale retains spaces, graphemes and empty input, validates length and resets all settings", async ({ page }) => {
  await authorizeTab(page);
  await page.goto(course + "/simulations/scytale");
  const input = page.getByLabel("Message", { exact: true });
  const source = " é e\u0301 👩‍💻 ";
  await input.fill(source);
  await next(page, 4);
  expect(await page.getByLabel("Message reconstitué", { exact: true }).textContent()).toBe(source);
  await input.fill("");
  await next(page, 4);
  await expect(page.getByLabel("Message reconstitué", { exact: true })).toHaveText("");
  await input.fill("a".repeat(81));
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#scytale-error")).toHaveText("Le message peut contenir jusqu’à 80 caractères.");
  await expect(control(page, "Lire")).toBeDisabled();
  await page.getByLabel("Gabarit de lecture", { exact: true }).selectOption("8");
  await control(page, "Recommencer").click();
  await expect(input).toHaveValue("RENDEZVOUS A MIDI");
  await expect(page.getByLabel("Gabarit d’écriture", { exact: true })).toHaveValue("3");
  await expect(page.getByLabel("Gabarit de lecture", { exact: true })).toHaveValue("3");
  await expect(input).not.toHaveAttribute("aria-invalid");
  await expect(counter(page)).toHaveText("Étape 0/4");
  await expect(control(page, "Lire")).toBeEnabled();
});

for (const example of examples) {
  test(example.id + " playback, visibility, end and route cleanup use the shared controls", async ({ page }) => {
    await authorizeTab(page);
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.clock.install({ time: new Date("2026-11-08T12:00:00Z") });
    const url = course + "/simulations/" + example.id;
    await page.goto(url);
    await page.clock.pauseAt(new Date("2026-11-08T12:01:00Z"));
    const buttons = page.getByRole("group", { name: "Lecture de l'exemple" }).getByRole("button");
    const labels = ["Précédent", "Lire", "Recommencer", "Suivant"];
    await expect(buttons).toHaveCount(labels.length);
    for (const [index, label] of labels.entries()) {
      await expect(buttons.nth(index)).toHaveAccessibleName(label);
      await expect(buttons.nth(index)).toHaveAttribute("title", label);
      await expect(buttons.nth(index).locator(".action-label")).toBeHidden();
      await expect(buttons.nth(index).locator("svg[aria-hidden=true]")).toBeVisible();
    }
    await control(page, "Suivant").focus();
    await page.keyboard.press("Enter");
    await expect(counter(page)).toHaveText("Étape 1/" + example.last);
    await control(page, "Lire").click();
    await expect(control(page, "Pause")).toHaveAttribute("title", "Pause");
    await page.clock.runFor(1000);
    await expect(counter(page)).toHaveText("Étape 2/" + example.last);
    await control(page, "Pause").click();
    await expect(control(page, "Lire")).toHaveAttribute("title", "Lire");
    await page.clock.runFor(2000);
    await expect(counter(page)).toHaveText("Étape 2/" + example.last);
    await control(page, "Lire").click();
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.clock.runFor(3000);
    await expect(counter(page)).toHaveText("Étape 2/" + example.last);
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.clock.runFor(2000);
    await expect(control(page, "Lire")).toBeVisible();
    await expect(counter(page)).toHaveText("Étape 2/" + example.last);
    await control(page, "Lire").click();
    await page.clock.runFor(example.last * 1000);
    await expect(counter(page)).toHaveText("Étape " + example.last + "/" + example.last);
    await expect(control(page, "Lire")).toBeDisabled();
    await control(page, "Recommencer").click();
    await expect(counter(page)).toHaveText("Étape 0/" + example.last);
    await page.clock.runFor(2000);
    await expect(counter(page)).toHaveText("Étape 0/" + example.last);
    await control(page, "Lire").click();
    await page.locator("#lite-back").click();
    await page.clock.runFor(5000);
    await page.getByRole("link", { name: "Ouvrir — " + example.title, exact: true }).click();
    await expect(counter(page)).toHaveText("Étape 0/" + example.last);
    expect(errors).toEqual([]);
  });

  test(example.id + " remains readable at desktop, phone and narrow widths with reduced motion", async ({ page }, info) => {
    await authorizeTab(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(course + "/simulations/" + example.id);
      await control(page, "Recommencer").click();
      if (example.id === "scytale") {
        await page.getByLabel("Message", { exact: true }).fill("A".repeat(80));
        await page.getByLabel("Gabarit d’écriture", { exact: true }).selectOption("2");
        await page.getByLabel("Gabarit de lecture", { exact: true }).selectOption("8");
      }
      await next(page, example.last);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(page.locator(".example-article")).toBeVisible();
      await expect(page.locator(".example-stage")).toBeVisible();
      await expect(control(page, "Précédent")).toBeVisible();
      expect(await page.locator(".example-stage").evaluate(element => getComputedStyle(element).animationName)).toBe("none");
      if (info.project.name === "desktop") {
        await mkdir(".omx/chapter1-examples/screenshots", { recursive: true });
        await page.screenshot({ path: ".omx/chapter1-examples/screenshots/" + example.id + "-" + width + ".png", fullPage: true });
      }
    }
  });
}
