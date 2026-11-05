import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const key = "ebbinghaus-viewer.session.v1";
const deck = [
  { question: "Comment s’appelle le vaisseau de notre histoire ?", answer: "L’Aurore." },
  { question: "Combien de lunes tournent autour de Néria ?", answer: "Deux : Ambre et Émeraude." },
  { question: "Qui compose l’équipage de L’Aurore ?", answer: "Mina, la pilote.\nÉloi, le navigateur." },
];
const requests = new WeakMap<Page, string[]>();
const errors = new WeakMap<Page, string[]>();

async function upload(page: Page, content: unknown = deck, name = "paquet-fictif.json"): Promise<void> {
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: /^Importer (tes cartes|un paquet)$/ }).click();
  await (await chooser).setFiles({
    name, mimeType: "application/json", buffer: Buffer.from(JSON.stringify(content)),
  });
}

async function snapshot(page: Page): Promise<string | null> {
  return page.evaluate((storageKey) => sessionStorage.getItem(storageKey), key);
}

async function capture(page: Page, info: TestInfo, name: string): Promise<void> {
  const directory = process.env.VIEWER_EVIDENCE_DIR
    ? resolve(process.env.VIEWER_EVIDENCE_DIR, "screenshots")
    : info.outputPath("screenshots");
  await mkdir(directory, { recursive: true });
  await page.screenshot({ path: resolve(directory, `${info.project.name}-${name}.png`), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

test.beforeEach(async ({ page }) => {
  requests.set(page, []);
  errors.set(page, []);
  page.on("request", (request) => requests.get(page)!.push(request.url()));
  page.on("pageerror", (error) => errors.get(page)!.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.get(page)!.push(message.text()); });
  await page.goto("/");
});

test.afterEach(async ({ page }, info) => {
  const urls = requests.get(page)!;
  await info.attach("network.json", { body: JSON.stringify(urls, null, 2), contentType: "application/json" });
  expect(urls.filter((url) => new URL(url).hostname !== "127.0.0.1")).toEqual([]);
  expect(errors.get(page)).toEqual([]);
});

test("full review, keyboard, undo, restart, shuffle and completion", async ({ page }, info) => {
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ebbinghaus Viewer");
  await expect(page.getByRole("heading", { level: 1 })).toBeInViewport();
  await expect(page.locator(".home-intro")).toHaveText("Importe tes flashcards pour les réviser.");
  await expect(page.locator(".screen-empty p")).toHaveCount(1);
  const homeLayout = await page.locator(".screen-empty").evaluate((element) => {
    const style = getComputedStyle(element);
    const center = element.getBoundingClientRect().x + element.getBoundingClientRect().width / 2;
    return {
      align: style.alignItems, text: style.textAlign,
      offsets: [...element.children].map((child) => {
        const box = child.getBoundingClientRect();
        return Math.abs(box.x + box.width / 2 - center);
      }),
    };
  });
  expect(homeLayout.align).toBe("center");
  expect(homeLayout.text).toBe("center");
  expect(homeLayout.offsets.every((offset) => offset < 1)).toBe(true);
  await expect(page.getByRole("button", { name: "Importer tes cartes", exact: true })).toBeVisible();
  await expect(page.locator("footer, .intro, .steps, .caption, .brand-caption")).toHaveCount(0);
  await expect(page.locator(".brand-name")).toHaveText("ebbinghaus");
  await expect(page.locator("#brand-icon svg")).toHaveAttribute("stroke-width", "2.2");
  await expect(page.locator("#brand-icon svg path")).toHaveCount(8);
  expect(await page.locator(".brand-mark").evaluate((element) => {
    const style = getComputedStyle(element);
    return [style.width, style.height, style.borderRadius];
  })).toEqual(["32px", "32px", "6px"]);
  expect(await page.locator(".brand-name").evaluate((element) => {
    const style = getComputedStyle(element);
    return [style.fontSize, style.fontWeight];
  })).toEqual(["15px", "600"]);
  const primaryColors = await page.evaluate(() => {
    const reference = document.createElement("span");
    reference.style.color = "oklch(0.22 0.015 250)";
    document.body.append(reference);
    const expected = getComputedStyle(reference).color;
    const actual = getComputedStyle(document.querySelector(".button-primary")!).backgroundColor;
    reference.remove();
    return { expected, actual };
  });
  expect(primaryColors.actual).toBe(primaryColors.expected);
  await capture(page, info, "home");

  // Exercise the real import action without opening the operating-system picker.
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Importer tes cartes", exact: true }).click();
  await (await chooser).setFiles(resolve("examples/paquet-fictif.json"));
  await expect(page.locator(".screen-ready")).toBeVisible();
  await expect(page.getByText("paquet-fictif.json", { exact: true })).toHaveCount(1);
  await expect(page.getByText("3 cartes", { exact: true })).toHaveCount(1);
  await expect(page.locator("#notice")).toBeEmpty();
  await expect(page.locator(".shuffle-question")).toHaveText("Veux-tu mélanger ton paquet ?");
  await expect(page.getByRole("button", { name: "Oui", exact: true })).toHaveClass(/button-primary/);
  await expect(page.getByRole("button", { name: "Non", exact: true })).toHaveClass(/button-outline/);
  await expect(page.getByRole("button", { name: "Oui", exact: true })).toBeFocused();
  await capture(page, info, "ready");

  await page.getByRole("button", { name: "Non", exact: true }).click();
  await expect(page.locator(".remaining")).toHaveText("3 cartes restantes");
  expect(JSON.parse((await snapshot(page))!).session.queue).toEqual([0, 1, 2]);
  await capture(page, info, "question");
  await page.locator('[data-action="reveal"]').press("Enter");
  await expect(page.getByRole("region", { name: "Réponse", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "J’ai trouvé", exact: true })).toBeFocused();
  await capture(page, info, "answer");
  await page.getByRole("button", { name: "À revoir", exact: true }).click();
  await expect(page.locator(".remaining")).toHaveText("3 cartes restantes");
  await expect(page.locator(".question-text")).toContainText("lunes");
  await page.getByRole("button", { name: "Annuler", exact: true }).click();
  await expect(page.locator(".answer-text")).toHaveText("L’Aurore.");
  await expect(page.getByRole("button", { name: "Annuler", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "J’ai trouvé", exact: true }).click();
  await expect(page.locator(".remaining")).toHaveText("2 cartes restantes");
  await page.locator('[data-action="reveal"]').click();
  await page.getByRole("button", { name: "J’ai trouvé", exact: true }).click();
  await page.locator('[data-action="reveal"]').click();
  await expect(page.locator(".answer-text")).toContainText("\n");
  await page.getByRole("button", { name: "J’ai trouvé", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Paquet terminé");
  await expect(page.locator(".complete-panel p, .complete-panel h2")).toHaveCount(0);
  await capture(page, info, "complete");
  await page.getByRole("button", { name: "Annuler", exact: true }).click();
  await expect(page.locator(".remaining")).toHaveText("1 carte restante");
  await expect(page.locator(".answer-text")).toContainText("Mina");
  await page.getByRole("button", { name: "J’ai trouvé", exact: true }).click();
  await page.getByRole("button", { name: "Recommencer", exact: true }).click();
  await page.getByRole("dialog", { name: "Recommencer le paquet ?", exact: true }).getByRole("button", { name: "Recommencer", exact: true }).click();
  await expect(page.locator(".card-count")).toHaveText("3 cartes");
  await page.getByRole("button", { name: "Oui", exact: true }).click();
  const shuffled = JSON.parse((await snapshot(page))!).session;
  expect([...shuffled.queue].sort()).toEqual([0, 1, 2]);
  await page.reload();
  expect(JSON.parse((await snapshot(page))!).session).toEqual(shuffled);
  await expect(page.locator(".remaining")).toHaveText("3 cartes restantes");
});

test("logo confirms unfinished sessions and cancellation preserves exact state", async ({ page }, info) => {
  await upload(page);
  await expect(page.locator(".screen-ready")).toBeVisible();
  for (const stage of ["ready", "question", "answer"] as const) {
    if (stage === "question") await page.getByRole("button", { name: "Non", exact: true }).click();
    if (stage === "answer") {
      await page.locator('[data-action="reveal"]').click();
      await page.getByRole("button", { name: "J’ai trouvé", exact: true }).click();
      await page.locator('[data-action="reveal"]').click();
    }
    const before = await snapshot(page);
    const content = await page.locator("#view").innerHTML();
    await page.locator("#home-button").click();
    await expect(page.getByRole("dialog", { name: "Revenir à l’accueil ?", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Rester", exact: true })).toBeFocused();
    if (stage === "answer") await capture(page, info, "home-confirmation");
    await page.getByRole("button", { name: "Rester", exact: true }).click();
    await expect(page.locator("#home-button")).toBeFocused();
    expect(await snapshot(page)).toBe(before);
    expect(await page.locator("#view").innerHTML()).toBe(content);
    await page.locator("#home-button").click();
    await page.keyboard.press("Escape");
    await expect(page.locator("#home-dialog")).not.toBeVisible();
    expect(await snapshot(page)).toBe(before);
  }
  await page.reload();
  await expect(page.locator(".answer-text")).toContainText("Ambre");
  await expect(page.getByRole("button", { name: "Annuler", exact: true })).toBeVisible();
  await page.locator("#home-button").click();
  await page.getByRole("button", { name: "Revenir à l’accueil", exact: true }).click();
  await expect(page.getByRole("button", { name: "Importer tes cartes", exact: true })).toBeFocused();
  expect(JSON.parse((await snapshot(page))!).session).toEqual({ kind: "empty" });
  await page.reload();
  await expect(page.locator(".screen-empty")).toBeVisible();
});

test("invalid, empty, cancelled and replacement imports preserve the current packet", async ({ page }, info) => {
  await upload(page);
  await page.getByRole("button", { name: "Non", exact: true }).click();
  await page.locator('[data-action="reveal"]').click();
  const before = await snapshot(page);
  await page.locator("#file-input").setInputFiles([]);
  expect(await snapshot(page)).toBe(before);
  for (const content of ["{", "[]"]) {
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Importer un paquet", exact: true }).click();
    await (await chooser).setFiles({ name: "invalide.json", mimeType: "application/json", buffer: Buffer.from(content) });
    await expect(page.getByRole("alert")).toContainText("Ton paquet est conservé.");
    await expect(page.locator("#import-button")).toBeFocused();
    expect(await snapshot(page)).toBe(before);
    await expect(page.locator(".answer-text")).toHaveText("L’Aurore.");
  }
  await upload(page, [{ question: "Une autre question fictive ?", answer: "Une autre réponse." }], "nouveau-paquet.json");
  await expect(page.getByRole("dialog", { name: "Remplacer le paquet ?", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Annuler", exact: true })).toBeFocused();
  await capture(page, info, "replace-confirmation");
  await page.getByRole("button", { name: "Annuler", exact: true }).click();
  await expect(page.locator("#import-button")).toBeFocused();
  expect(await snapshot(page)).toBe(before);
  await upload(page, [{ question: "Une autre question fictive ?", answer: "Une autre réponse." }], "nouveau-paquet.json");
  await expect(page.locator("#replace-dialog")).toBeVisible();
  await expect(page.getByRole("button", { name: "Annuler", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator("#replace-dialog")).not.toBeVisible();
  expect(await snapshot(page)).toBe(before);
  await upload(page, [{ question: "Une autre question fictive ?", answer: "Une autre réponse." }], "nouveau-paquet.json");
  await page.getByRole("button", { name: "Remplacer", exact: true }).click();
  await expect(page.locator(".card-count")).toHaveText("1 carte");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("nouveau-paquet.json");
  await page.getByRole("button", { name: "Non", exact: true }).click();
  await page.locator('[data-action="reveal"]').click();
  await page.getByRole("button", { name: "À revoir", exact: true }).click();
  await expect(page.locator(".remaining")).toHaveText("1 carte restante");
  await page.locator('[data-action="reveal"]').click();
  await page.getByRole("button", { name: "J’ai trouvé", exact: true }).click();
  await page.locator("#home-button").click();
  await expect(page.locator(".screen-empty")).toBeVisible();
  await expect(page.locator("#home-dialog")).not.toBeVisible();
});

test("partial imports warn once and hostile content stays literal text", async ({ page }, info) => {
  const question = '<img src="https://example.invalid/leak" onerror="alert(1)">';
  const answer = '<script>alert(1)</script>\nhttps://example.invalid/secret\n**Texte brut**';
  await upload(page, [{ question, answer }, { question: "", answer: "invalide" }], "paquet-partiel.json");
  await expect(page.locator(".card-count")).toHaveText("1 carte");
  await expect(page.locator("#notice")).toHaveText("1 carte ignorée : contenu incomplet ou invalide.");
  await capture(page, info, "partial-import");
  await page.getByRole("button", { name: "Non", exact: true }).click();
  await expect(page.locator("#notice")).toBeEmpty();
  await expect(page.locator(".question-text")).toHaveText(question);
  await page.locator('[data-action="reveal"]').click();
  await expect(page.locator(".answer-text")).toHaveText(answer);
  await expect(page.locator("#view img, #view script, #view a")).toHaveCount(0);
  await capture(page, info, "literal-content");
});

test("storage failures remain actionable and review still works in memory", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "sessionStorage", { get() { throw new DOMException("Blocked", "SecurityError"); } });
  });
  await page.reload();
  await expect(page.locator("#storage-note")).toContainText("La sauvegarde est indisponible.");
  await upload(page, [deck[0]]);
  await expect(page.locator("#storage-note")).toContainText("Tu peux continuer à réviser");
  await page.getByRole("button", { name: "Oui", exact: true }).click();
  await page.locator('[data-action="reveal"]').click();
  await page.getByRole("button", { name: "J’ai trouvé", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Paquet terminé");
});

test("delayed and unreadable imports protect navigation and the current answer", async ({ page }) => {
  await page.addInitScript(() => {
    const original = File.prototype.text;
    let finish: (() => void) | undefined;
    Object.assign(window, { finishImport: () => finish?.() });
    File.prototype.text = async function () {
      if (this.name === "illisible.json") throw new DOMException("Unreadable", "NotReadableError");
      if (this.name === "lent.json") await new Promise<void>((resolveRead) => { finish = resolveRead; });
      return original.call(this);
    };
  });
  await page.reload();
  await upload(page, deck, "lent.json");
  await expect(page.locator("#home-button")).toBeDisabled();
  await expect(page.getByRole("button", { name: "Lecture du paquet…", exact: true })).toBeDisabled();
  await page.evaluate(() => (window as unknown as { finishImport: () => void }).finishImport());
  await expect(page.locator(".screen-ready")).toBeVisible();
  await expect(page.locator("#home-button")).toBeEnabled();
  await page.getByRole("button", { name: "Non", exact: true }).click();
  await page.locator('[data-action="reveal"]').click();
  const before = await snapshot(page);
  await upload(page, deck, "lent.json");
  await expect(page.getByRole("button", { name: "Accueil", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Recommencer", exact: true })).toBeDisabled();
  await expect(page.locator("#home-button")).toBeDisabled();
  await page.evaluate(() => (window as unknown as { finishImport: () => void }).finishImport());
  await expect(page.locator("#replace-dialog")).toBeVisible();
  await page.getByRole("button", { name: "Annuler", exact: true }).click();
  expect(await snapshot(page)).toBe(before);
  await expect(page.getByRole("button", { name: "Accueil", exact: true })).toBeEnabled();
  await upload(page, deck, "illisible.json");
  await expect(page.getByRole("alert")).toHaveText("Impossible de lire ce paquet. Sélectionne-le à nouveau ou essaie un autre paquet. Ton paquet est conservé.");
  await expect(page.locator("#import-button")).toBeFocused();
  await expect(page.locator(".answer-text")).toHaveText("L’Aurore.");
  expect(await snapshot(page)).toBe(before);
});

test("long text and packet names wrap without horizontal overflow", async ({ page }, info) => {
  await upload(page, [{ question: "QuestionFictive".repeat(60), answer: "RéponseFictive".repeat(100) }], `${"paquet".repeat(30)}.json`);
  await expect(page.locator(".screen-ready")).toBeVisible();
  await capture(page, info, "long-ready");
  await page.getByRole("button", { name: "Non", exact: true }).click();
  await capture(page, info, "long-question");
  await page.locator('[data-action="reveal"]').click();
  await capture(page, info, "long-answer");
});

test("Oui shuffles deterministically and Non restores exact file order after restart", async ({ page }) => {
  await page.addInitScript(() => { Math.random = () => 0; });
  await page.reload();
  await upload(page);
  await page.getByRole("button", { name: "Oui", exact: true }).click();
  await expect(page.locator(".question-text")).toHaveText(deck[1]!.question);
  expect(JSON.parse((await snapshot(page))!).session.queue).toEqual([1, 2, 0]);
  await page.getByRole("button", { name: "Recommencer", exact: true }).click();
  await page.getByRole("dialog", { name: "Recommencer le paquet ?", exact: true }).getByRole("button", { name: "Recommencer", exact: true }).click();
  await expect(page.locator(".shuffle-question")).toHaveText("Veux-tu mélanger ton paquet ?");
  await page.getByRole("button", { name: "Non", exact: true }).click();
  await expect(page.locator(".question-text")).toHaveText(deck[0]!.question);
  expect(JSON.parse((await snapshot(page))!).session.queue).toEqual([0, 1, 2]);
});

test("rating labels remain clear, contrast is sufficient, and both choices can be undone", async ({ page }, info) => {
  await upload(page);
  await page.getByRole("button", { name: "Non", exact: true }).click();
  await page.locator('[data-action="reveal"]').click();
  await page.getByRole("button", { name: "J’ai trouvé", exact: true }).click();
  await expect(page.locator(".remaining")).toHaveText("2 cartes restantes");
  await page.locator('[data-action="reveal"]').click();
  await capture(page, info, "answer-with-undo");
  await expect(page.locator(".undo-actions")).toHaveCount(0);
  const originalViewport = page.viewportSize()!;
  for (const viewport of [originalViewport, { width: 320, height: 740 }]) {
    await page.setViewportSize(viewport);
    const layout = await page.locator(".secondary-actions").evaluate((element) => {
      const row = element.getBoundingClientRect();
      return [...element.querySelectorAll("button")].map((button) => {
        const box = button.getBoundingClientRect();
        return { label: button.textContent, x: box.x, right: box.right, y: box.y, center: box.x + box.width / 2, rowCenter: row.x + row.width / 2 };
      });
    });
    expect(layout.map((button) => button.label)).toEqual(["Accueil", "Annuler", "Recommencer"]);
    expect(Math.abs(layout[1]!.center - layout[1]!.rowCenter)).toBeLessThan(1);
    expect(layout[0]!.right).toBeLessThanOrEqual(layout[1]!.x);
    expect(layout[1]!.right).toBeLessThanOrEqual(layout[2]!.x);
    expect(Math.max(...layout.map((button) => button.y)) - Math.min(...layout.map((button) => button.y))).toBeLessThan(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await capture(page, info, "narrow-undo-navigation");
  await page.setViewportSize(originalViewport);

  for (const label of ["J’ai trouvé", "À revoir"]) {
    const button = page.getByRole("button", { name: label, exact: true });
    for (const state of ["normal", "hover", "focus"]) {
      if (state === "hover") await button.hover();
      if (state === "focus") await button.focus();
      const colors = await button.evaluate((element) => {
        const style = getComputedStyle(element);
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 1;
        const context = canvas.getContext("2d")!;
        function channels(color: string): number[] {
          context.fillStyle = color;
          context.fillRect(0, 0, 1, 1);
          return [...context.getImageData(0, 0, 1, 1).data].slice(0, 3);
        }
        function luminance(rgb: number[]): number {
          const linear = rgb.map((channel) => channel / 255).map((channel) => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4);
          return linear[0]! * .2126 + linear[1]! * .7152 + linear[2]! * .0722;
        }
        const background = channels(style.backgroundColor);
        const values = [luminance(channels(style.color)), luminance(background)].sort((a, b) => a - b);
        return { background, contrast: (values[1]! + .05) / (values[0]! + .05) };
      });
      expect(colors.contrast, `${label} ${state} text contrast`).toBeGreaterThanOrEqual(4.5);
      if (label === "J’ai trouvé") expect(colors.background[1]!).toBeGreaterThan(colors.background[0]!);
      else expect(colors.background[0]!).toBeGreaterThan(colors.background[1]!);
    }
  }
  await page.emulateMedia({ forcedColors: "active" });
  await expect(page.getByRole("button", { name: "J’ai trouvé", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "À revoir", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Annuler", exact: true }).click();
  await expect(page.locator(".answer-text")).toHaveText(deck[0]!.answer);
  await expect(page.locator("#revealed-answer")).toBeFocused();
  expect(JSON.parse((await snapshot(page))!).session.queue).toEqual([0, 1, 2]);
  await page.getByRole("button", { name: "À revoir", exact: true }).click();
  await expect(page.locator(".question-text")).toHaveText(deck[1]!.question);
  expect(JSON.parse((await snapshot(page))!).session.queue).toEqual([1, 2, 0]);
  await page.getByRole("button", { name: "Annuler", exact: true }).click();
  await expect(page.locator(".answer-text")).toHaveText(deck[0]!.answer);
  expect(JSON.parse((await snapshot(page))!).session.queue).toEqual([0, 1, 2]);
});

test("Accueil matches the logo confirmation and preserves review state when cancelled", async ({ page }, info) => {
  await upload(page);
  await page.getByRole("button", { name: "Non", exact: true }).click();
  for (const state of ["question", "answer"]) {
    if (state === "answer") {
      await page.locator('[data-action="reveal"]').click();
      await page.getByRole("button", { name: "J’ai trouvé", exact: true }).click();
      await page.locator('[data-action="reveal"]').click();
    }
    const before = await snapshot(page);
    const content = await page.locator("#view").innerHTML();
    const home = page.getByRole("button", { name: "Accueil", exact: true });
    await expect(home.locator('svg[aria-hidden="true"] path')).toHaveCount(2);
    const restart = page.getByRole("button", { name: "Recommencer", exact: true });
    const homeBox = (await home.boundingBox())!;
    const restartBox = (await restart.boundingBox())!;
    expect(homeBox.x).toBeLessThan(restartBox.x);
    expect(Math.abs(homeBox.y - restartBox.y)).toBeLessThan(1);
    await home.click();
    await expect(page.getByRole("dialog", { name: "Revenir à l’accueil ?", exact: true })).toBeVisible();
    if (state === "answer") await capture(page, info, "accueil-confirmation");
    await page.getByRole("button", { name: "Rester", exact: true }).click();
    await expect(home).toBeFocused();
    expect(await snapshot(page)).toBe(before);
    expect(await page.locator("#view").innerHTML()).toBe(content);
    await home.click();
    await page.keyboard.press("Escape");
    await expect(page.locator("#home-dialog")).not.toBeVisible();
    expect(await snapshot(page)).toBe(before);
  }
  await page.getByRole("button", { name: "Accueil", exact: true }).click();
  await page.getByRole("button", { name: "Revenir à l’accueil", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ebbinghaus Viewer");
  await expect(page.getByRole("button", { name: "Importer tes cartes", exact: true })).toBeFocused();
  expect(JSON.parse((await snapshot(page))!).session).toEqual({ kind: "empty" });
  await page.reload();
  await expect(page.locator(".screen-empty")).toBeVisible();
});

for (const stage of ["question", "answer", "complete"] as const) {
  test(`restart confirmation preserves ${stage} on cancel and resets the full packet on confirm`, async ({ page }, info) => {
    await upload(page);
    await page.getByRole("button", { name: "Non", exact: true }).click();
    await page.locator('[data-action="reveal"]').click();
    await page.getByRole("button", { name: "J’ai trouvé", exact: true }).click();
    if (stage === "answer") await page.locator('[data-action="reveal"]').click();
    if (stage === "complete") {
      for (let index = 0; index < 2; index++) {
        await page.locator('[data-action="reveal"]').click();
        await page.getByRole("button", { name: "J’ai trouvé", exact: true }).click();
      }
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Paquet terminé");
    } else await expect(page.locator(".remaining")).toHaveText("2 cartes restantes");
    const before = await snapshot(page);
    const content = await page.locator("#view").innerHTML();
    const trigger = page.locator('[data-action="restart"]');
    const dialog = page.getByRole("dialog", { name: "Recommencer le paquet ?", exact: true });
    await trigger.click();
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Tu vas reprendre toutes les cartes depuis le début.");
    await expect(dialog.getByRole("button", { name: "Annuler", exact: true })).toBeFocused();
    expect(await snapshot(page)).toBe(before);
    if (stage === "answer") await capture(page, info, "restart-confirmation");
    await dialog.getByRole("button", { name: "Annuler", exact: true }).click();
    await expect(trigger).toBeFocused();
    expect(await snapshot(page)).toBe(before);
    expect(await page.locator("#view").innerHTML()).toBe(content);
    await trigger.click();
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    expect(await snapshot(page)).toBe(before);
    expect(await page.locator("#view").innerHTML()).toBe(content);
    await trigger.click();
    await dialog.getByRole("button", { name: "Recommencer", exact: true }).click();
    await expect(page.locator(".card-count")).toHaveText("3 cartes");
    await expect(page.getByRole("button", { name: "Oui", exact: true })).toBeFocused();
    await expect(page.getByRole("button", { name: "Annuler", exact: true })).toHaveCount(0);
    expect(JSON.parse((await snapshot(page))!).session.kind).toBe("ready");
    await page.getByRole("button", { name: "Non", exact: true }).click();
    await expect(page.locator(".question-text")).toHaveText(deck[0]!.question);
    expect(JSON.parse((await snapshot(page))!).session.queue).toEqual([0, 1, 2]);
  });
}
