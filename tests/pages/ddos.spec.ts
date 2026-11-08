import { expect, test, type Page } from "@playwright/test";
import { authorizeTab } from "../archive-fixture.ts";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const root = "/ebbinghaus-lite/";
const cyber = root + "#/he2b/esi/introduction-a-la-cybersecurite";
const simulation = cyber + "/simulations/ddos";
const time = (page: Page) => page.locator("[data-ddos-time]");
const button = (page: Page, name: string | RegExp) => page.getByRole("button", { name, exact: true });
const next = (page: Page) => button(page, "Suivant").click();
const attack = (page: Page) => button(page, /Lancer l.attaque/).click();
const stopAttack = (page: Page) => button(page, /Arrêter l.attaque/).click();

test.beforeEach(async ({ page }) => { await authorizeTab(page); });

async function counts(page: Page, metric: string, expected: readonly number[]): Promise<void> {
  await expect(page.locator(`[data-metric="${metric}"] td[data-kind]`))
    .toHaveText(expected.map(String));
}

async function control(page: Page, name: string, value: string): Promise<void> {
  const slider = page.getByRole("slider", { name, exact: true });
  await slider.press("Home");
  const minimum = Number(await slider.getAttribute("min"));
  for (let n = minimum; n < Number(value); n++) await slider.press("ArrowRight");
}

test("DDoS is discoverable only in cybersecurity and uses Lite navigation", async ({ page }, info) => {
  const requests: string[] = [];
  const errors: string[] = [];
  page.on("request", request => requests.push(request.url()));
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto(root + "#/he2b/esi/algorithmique-i");
  await expect(page.getByRole("heading", { name: "Exemples interactifs" })).toHaveCount(0);
  await page.goto(cyber);
  await expect(page.getByRole("heading", { name: "Exemples interactifs" })).toBeVisible();
  const back = page.locator("#lite-back");
  const before = await back.boundingBox();
  await page.getByRole("link", { name: "Ouvrir — Chapitre 1 • DDoS", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(simulation + "$"));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Chapitre 1 • DDoS");
  await expect(back).toHaveText("Retour au cours");
  const after = await back.boundingBox();
  expect(after?.x).toBe(before?.x);
  expect(after?.y).toBe(before?.y);
  if (info.project.name === "desktop") {
    await expect(page.locator('#lite-breadcrumbs [aria-current="page"]')).toHaveText("Chapitre 1 • DDoS");
    await expect(page.locator("#lite-breadcrumbs").getByRole("link", { name: "Introduction à la cybersécurité" }))
      .toHaveAttribute("href", cyber.slice(root.length));
  }
  await next(page);
  await page.reload();
  await expect(time(page)).toHaveText("0 s");
  await page.goBack();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Introduction à la cybersécurité");
  await page.goForward();
  await expect(time(page)).toHaveText("0 s");
  await back.click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Introduction à la cybersécurité");
  await page.goto(simulation);
  await page.getByRole("link", { name: "ebbinghaus lite — Accueil" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Révise tes cours");
  await page.goto(cyber + "/simulations/inconnue");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Page introuvable");
  expect(errors).toEqual([]);
  const origin = new URL(page.url()).origin;
  expect(requests.length).toBeGreaterThan(0);
  expect(requests.every(url => new URL(url).origin === origin &&
    new URL(url).pathname.startsWith(root) && !new URL(url).pathname.includes("/api/"))).toBe(true);
});

test("displayed reference scenario conserves traffic and replays history", async ({ page }) => {
  await page.goto(simulation);
  await expect(time(page)).toHaveText("0 s");
  await expect(button(page, "Précédent")).toBeDisabled();
  await counts(page, "queue", [0, 0, 0]);
  await next(page);
  await expect(time(page)).toHaveText("1 s");
  await counts(page, "arrived", [4, 0, 4]);
  await counts(page, "processed", [4, 0, 4]);
  await counts(page, "queue", [0, 0, 0]);
  await attack(page);
  await expect(time(page)).toHaveText("1 s");
  await next(page);
  await counts(page, "arrived", [4, 12, 16]);
  await counts(page, "processed", [2, 6, 8]);
  await counts(page, "queue", [2, 6, 8]);
  await counts(page, "dropped", [0, 0, 0]);
  await expect(page.locator("svg.ddos-scene")).toHaveAccessibleDescription(/8 requêtes en attente/);
  const snapshot = await page.locator("[data-metric]").allTextContents();
  await stopAttack(page);
  await next(page);
  await counts(page, "queue", [4, 0, 4]);
  await expect(page.locator("svg.ddos-scene")).toHaveAccessibleDescription(/4 requêtes en attente/);
  await next(page);
  await counts(page, "queue", [0, 0, 0]);
  await button(page, "Précédent").click();
  await button(page, "Précédent").click();
  await expect(time(page)).toHaveText("2 s");
  expect(await page.locator("[data-metric]").allTextContents()).toEqual(snapshot);
  await expect(button(page, /Arrêter l.attaque/)).toBeVisible();
  await next(page);
  await counts(page, "queue", [4, 0, 4]);
  await expect(button(page, /Lancer l.attaque/)).toBeVisible();
  await button(page, "Recommencer").click();
  await expect(time(page)).toHaveText("0 s");
  await counts(page, "arrived", [0, 0, 0]);
  await counts(page, "queue", [0, 0, 0]);
  await expect(page.getByRole("slider", { name: "Machines compromises", exact: true })).toHaveValue("6");
  await expect(page.getByRole("slider", { name: "Débit par machine", exact: true })).toHaveValue("2");
  await expect(page.getByRole("slider", { name: "Capacité du serveur", exact: true })).toHaveValue("8");
});

test("media controls separate attack, pause resumes and square reset stays paused", async ({ page }, info) => {
  await page.clock.install({ time: new Date("2026-11-08T12:00:00Z") });
  await page.goto(simulation);
  await page.clock.pauseAt(new Date("2026-11-08T12:01:00Z"));
  const playback = page.getByRole("group", { name: "Lecture de l'exemple" });
  await expect(playback.getByRole("button")).toHaveText(["Précédent", "Lire", "Suivant", "Recommencer"]);
  for (const control of await page.locator(".ddos-toolbar button").all()) {
    await expect(control.locator("svg[aria-hidden=true]")).toBeVisible();
  }
  const toolbarBounds = await page.locator(".ddos-toolbar").boundingBox();
  const playbackBounds = await playback.boundingBox();
  const attackBounds = await button(page, /Lancer l.attaque/).boundingBox();
  expect(Math.abs(attackBounds!.x + attackBounds!.width - toolbarBounds!.x - toolbarBounds!.width)).toBeLessThan(1);
  if (info.project.name === "desktop") {
    expect(attackBounds!.x).toBeGreaterThanOrEqual(playbackBounds!.x + playbackBounds!.width);
    for (const control of await playback.getByRole("button").all()) {
      expect((await control.boundingBox())!.y).toBe(playbackBounds!.y);
    }
  } else {
    expect(attackBounds!.y).toBeGreaterThanOrEqual(playbackBounds!.y + playbackBounds!.height);
  }
  const playIcon = await button(page, "Lire").locator("svg").innerHTML();
  await button(page, "Lire").click();
  await page.clock.runFor(2000);
  await expect(time(page)).toHaveText("2 s");
  const pauseIcon = await button(page, "Pause").locator("svg").innerHTML();
  expect(pauseIcon).not.toBe(playIcon);
  await button(page, "Pause").click();
  await page.clock.runFor(2000);
  await expect(time(page)).toHaveText("2 s");
  expect(await button(page, "Lire").locator("svg").innerHTML()).toBe(playIcon);
  await button(page, "Lire").click();
  await page.clock.runFor(1000);
  await expect(time(page)).toHaveText("3 s");
  await button(page, "Recommencer").click();
  await page.clock.runFor(2000);
  await expect(time(page)).toHaveText("0 s");
  await expect(button(page, "Lire")).toBeVisible();
  await button(page, "Lire").click();
  await page.clock.runFor(1000);
  await expect(time(page)).toHaveText("1 s");
  const article = page.getByRole("article", { name: "Comprendre l'attaque DDoS" });
  await expect(article).toBeVisible();
  await expect(article.locator("details, summary")).toHaveCount(0);
  for (const heading of ["Quand le serveur suit le rythme", "Des machines compromises multiplient le trafic",
    "La disponibilité se dégrade", "L'arrêt de l'attaque ne vide pas la file"]) {
    await expect(article.getByRole("heading", { name: heading, exact: true })).toBeVisible();
  }
  await expect(article.getByText("4 + 6 × 2 = 16 requêtes/s", { exact: true })).toBeVisible();
  await expect(article.getByRole("link", { name: "Chapitre 1 · Déni de service" }))
    .toHaveAttribute("href", /959f789db9fef7649b6b61cb8f812a2909091d41/);
});

test("a parameter change preserves the selected backlog and replaces only the future", async ({ page }) => {
  await page.goto(simulation);
  await attack(page);
  await next(page);
  await counts(page, "queue", [2, 6, 8]);
  await next(page);
  await counts(page, "queue", [4, 12, 16]);
  await button(page, "Précédent").click();
  await control(page, "Capacité du serveur", "32");
  await expect(time(page)).toHaveText("1 s");
  await counts(page, "queue", [2, 6, 8]);
  await next(page);
  await counts(page, "processed", [6, 18, 24]);
  await counts(page, "queue", [0, 0, 0]);
  await button(page, "Précédent").click();
  await expect(page.getByRole("slider", { name: "Capacité du serveur", exact: true })).toHaveValue("8");
  await next(page);
  await expect(page.getByRole("slider", { name: "Capacité du serveur", exact: true })).toHaveValue("32");
  await counts(page, "queue", [0, 0, 0]);
  await control(page, "Machines compromises", "12");
  await control(page, "Débit par machine", "8");
  await control(page, "Capacité du serveur", "1");
  for (let i = 0; i < 4; i++) await next(page);
  await expect(page.locator('[data-metric="queue"] [data-kind="total"]')).toHaveText("200");
  const rejected = Number(await page.locator('[data-metric="dropped"] [data-kind="total"]').textContent());
  expect(rejected).toBeGreaterThan(0);
});

test("play, pause, changes, visibility, route cleanup, and the endpoint", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-11-08T12:00:00Z") });
  await page.goto(simulation);
  // Freeze wall time as well as mocking it: only runFor may fire a tick.
  await page.clock.pauseAt(new Date("2026-11-08T12:01:00Z"));
  await page.clock.runFor(3000);
  await expect(time(page)).toHaveText("0 s");
  await button(page, "Lire").click();
  await page.clock.runFor(2000);
  await expect(time(page)).toHaveText("2 s");
  await button(page, "Pause").click();
  await page.clock.runFor(2000);
  await expect(time(page)).toHaveText("2 s");
  await button(page, "Lire").click();
  await control(page, "Débit par machine", "3");
  await page.clock.runFor(2000);
  await expect(time(page)).toHaveText("2 s");
  await expect(button(page, "Lire")).toBeVisible();
  await button(page, "Lire").click();
  await attack(page);
  await page.clock.runFor(2000);
  await expect(time(page)).toHaveText("2 s");
  await button(page, "Lire").click();
  // A synthetic hidden transition exercises the same document lifecycle hook
  // without depending on headless Chrome's background-tab policy.
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.clock.runFor(2000);
  await expect(time(page)).toHaveText("2 s");
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(button(page, "Lire")).toBeVisible();
  await page.clock.runFor(1000);
  await expect(time(page)).toHaveText("2 s");
  await button(page, "Lire").click();
  const abandonedTime = await time(page).elementHandle();
  await page.locator("#lite-back").click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Introduction à la cybersécurité");
  // hashchange is asynchronous: measure after leaving, not before the click.
  const leftAt = await abandonedTime!.textContent();
  await page.clock.runFor(3000);
  expect(await abandonedTime!.textContent()).toBe(leftAt);
  await page.goBack();
  await expect(time(page)).toHaveText("0 s");
  await button(page, "Lire").click();
  await page.clock.runFor(121000);
  await expect(time(page)).toHaveText("120 s");
  await expect(button(page, "Lire")).toBeDisabled();
  await expect(button(page, "Suivant")).toBeDisabled();
  await expect(button(page, "Précédent")).toBeEnabled();
  await button(page, "Précédent").click();
  await expect(time(page)).toHaveText("119 s");
  await expect(button(page, "Lire")).toBeEnabled();
  await next(page);
  await expect(time(page)).toHaveText("120 s");
  await button(page, "Recommencer").click();
  await expect(time(page)).toHaveText("0 s");
});

test("the diagram remains truthful and bounded at zero bots and a full queue", async ({ page }) => {
  await page.goto(simulation);
  await control(page, "Machines compromises", "0");
  await attack(page);
  await next(page);
  await counts(page, "arrived", [4, 0, 4]);
  const scene = page.locator("svg.ddos-scene");
  await expect(scene.getByText("0 machines", { exact: true })).toBeVisible();
  await control(page, "Machines compromises", "12");
  await control(page, "Débit par machine", "8");
  await control(page, "Capacité du serveur", "1");
  for (let i = 0; i < 4; i++) await next(page);
  await counts(page, "arrived", [4, 96, 100]);
  await expect(scene).toHaveAccessibleDescription(/200 requêtes en attente/);
  const dimensions = await scene.evaluate(element => {
    const svg = element as SVGSVGElement;
    const box = svg.getBBox();
    return { x: box.x, y: box.y, width: box.width, height: box.height,
      limitWidth: svg.viewBox.baseVal.width, limitHeight: svg.viewBox.baseVal.height };
  });
  expect(dimensions.x).toBeGreaterThanOrEqual(0);
  expect(dimensions.y).toBeGreaterThanOrEqual(0);
  expect(dimensions.x + dimensions.width).toBeLessThanOrEqual(dimensions.limitWidth);
  expect(dimensions.y + dimensions.height).toBeLessThanOrEqual(dimensions.limitHeight);
});

test("keyboard, mobile sizes, accessible scene and reduced motion", async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(simulation);
  const forward = button(page, "Suivant");
  await forward.focus();
  await page.keyboard.press("Enter");
  await expect(time(page)).toHaveText("1 s");
  await expect(forward).toBeFocused();
  const capacity = page.getByRole("slider", { name: "Capacité du serveur", exact: true });
  await capacity.focus();
  await page.keyboard.press("ArrowRight");
  await expect(capacity).toHaveValue("9");
  await expect(capacity).toBeFocused();
  await attack(page);
  if (info.project.name === "mobile") await forward.tap();
  else await next(page);
  const scene = page.locator("svg.ddos-scene");
  await expect(scene).toHaveRole("img");
  await expect(scene).toHaveAccessibleName(/.+/);
  await expect(page.getByRole("table", { name: "Dernière seconde" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Normales" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Attaque" })).toBeVisible();
  const widths = info.project.name === "desktop" ? [1440] : [390, 320];
  const evidence = resolve(".omx/ddos/screenshots");
  await mkdir(evidence, { recursive: true });
  await page.locator("#portal-main").focus();
  for (const width of widths) {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const element of await page.locator('.ddos-view button, .ddos-view input[type="range"]').all()) {
      const bounds = await element.boundingBox();
      expect(bounds?.height).toBeGreaterThanOrEqual(44);
      expect(bounds?.width).toBeGreaterThanOrEqual(44);
    }
    const animations = await scene.evaluate(element => element.getAnimations({ subtree: true }).map(a => a.playState));
    expect(animations.filter(state => state === "running")).toEqual([]);
    await page.evaluate(() => { (document.activeElement as HTMLElement | null)?.blur(); scrollTo(0, 0); });
    await page.screenshot({ path: resolve(evidence, `ddos-${width}.png`), fullPage: true });
  }
});
