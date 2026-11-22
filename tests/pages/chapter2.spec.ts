import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { authorizeTab, root } from "../archive-fixture.ts";

const will = root + "#/he2b/esi/introduction-a-la-cybersecurite/simulations/testament";
const original = "À ma mort, ma fortune sera partagée à parts égales entre mes trois fils. Toutefois, George ne recevra rien.";
const counter = (page: Page) => page.locator("[data-example-step]");
const control = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
async function next(page: Page, count = 1): Promise<void> {
  for (let n = 0; n < count; n++) await control(page, "Suivant").click();
}

test("the will example detects George's change and steps back without losing state", async ({ page }, info) => {
  await authorizeTab(page);
  await page.goto(will);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Chapitre 2 • Testament du milliardaire");
  await expect(counter(page)).toHaveText("Étape 0/6");
  await expect(control(page, "Suivant")).toBeEnabled();
  await next(page, 3);
  await expect(page.locator('[data-actor="notary-a"] dd')).toHaveText(["Original"]);
  await expect(page.locator('[data-actor="notary-b"] dd')).toHaveText([/^[0-9a-f]{16}…$/, "Aucun"]);
  await next(page);
  await expect(page.locator('[data-actor="notary-a"] dd')).toHaveText(["Modifié"]);
  await control(page, "Précédent").click();
  await expect(counter(page)).toHaveText("Étape 3/6");
  await expect(page.locator('[data-actor="notary-a"] dd')).toHaveText(["Original"]);
  await next(page, 3);
  await expect(counter(page)).toHaveText("Étape 6/6");
  await expect(page.locator("[data-will-verdict]")).toHaveAttribute("data-will-verdict", "altered");
  const hashes = page.locator(".will-comparison code");
  await expect(hashes.nth(0)).toHaveText(/^[0-9a-f]{64}$/);
  expect(await hashes.nth(0).textContent()).not.toEqual(await hashes.nth(1).textContent());
  await expect(control(page, "Suivant")).toBeDisabled();
  if (info.project.name === "desktop") {
    await mkdir(".omx/chapter2-examples/screenshots", { recursive: true });
    await page.screenshot({ path: ".omx/chapter2-examples/screenshots/testament-final.png", fullPage: true });
  }
  await control(page, "Recommencer").click();
  await expect(counter(page)).toHaveText("Étape 0/6");
});

test("editing the will live: altered text mismatches, the original text matches again", async ({ page }) => {
  await authorizeTab(page);
  await page.goto(will);
  const status = page.locator("[data-will-live]");
  await expect(status).toHaveAttribute("data-will-live", "altered");
  const input = page.getByLabel("Testament présenté à la lecture");
  await input.fill(original);
  await expect(status).toHaveAttribute("data-will-live", "intact");
  await expect(status).toHaveText("Empreintes identiques : testament intact");
  await input.fill(original + ".");
  await expect(status).toHaveAttribute("data-will-live", "altered");
});

const padding = root + "#/he2b/esi/introduction-a-la-cybersecurite/simulations/blocs-bourrage";

test("the blocks and padding example cuts the message into 11 blocks and pads the last", async ({ page }, info) => {
  await authorizeTab(page);
  await page.goto(padding);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Chapitre 2 • Blocs et bourrage");
  await expect(counter(page)).toHaveText("Étape 0/3");
  await next(page);
  const blocks = page.locator(".example-stage [data-block]");
  await expect(blocks).toHaveCount(11);
  await expect(blocks.last().locator(".padding-empty")).toHaveCount(11);
  await next(page);
  await expect(blocks).toHaveCount(11);
  await expect(blocks.last()).toHaveAttribute("data-block-padding", "11");
  await expect(blocks.last().locator(".padding-pad")).toHaveText(Array(11).fill("0b"));
  await expect(blocks.first()).toHaveAttribute("data-block-padding", "0");
  await next(page);
  await expect(page.locator("[data-padding-recovered]")).toHaveAttribute("data-padding-recovered", "true");
  await expect(control(page, "Suivant")).toBeDisabled();
  if (info.project.name === "desktop") {
    await mkdir(".omx/chapter2-examples/screenshots", { recursive: true });
    await control(page, "Précédent").click();
    await page.screenshot({ path: ".omx/chapter2-examples/screenshots/blocs-bourrage.png", fullPage: true });
  }
});

test("padding lab: a message that fits exactly gets a full block of padding", async ({ page }) => {
  await authorizeTab(page);
  await page.goto(padding);
  const summary = page.locator("[data-padding-blocks]");
  const input = page.getByLabel("Message à découper");
  await input.fill("abc");
  await expect(summary).toHaveAttribute("data-padding-blocks", "1");
  await expect(summary).toHaveAttribute("data-padding-bytes", "13");
  await input.fill("ABCDEFGHIJKLMNOP");
  await expect(summary).toHaveAttribute("data-padding-blocks", "2");
  await expect(summary).toHaveAttribute("data-padding-bytes", "16");
  await page.getByLabel("Taille de bloc").selectOption("8");
  await expect(summary).toHaveAttribute("data-padding-blocks", "3");
  await expect(summary).toHaveAttribute("data-padding-bytes", "8");
  await input.fill("é");
  await expect(summary).toHaveAttribute("data-padding-bytes", "6");
});
