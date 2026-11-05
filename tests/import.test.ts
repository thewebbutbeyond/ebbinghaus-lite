import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_CARDS, MAX_FILE_BYTES, MAX_TEXT_LENGTH, parseDeck, readDeck, validateDeck } from "../src/import.ts";

const card = { question: "Où va L’Aurore ?", answer: "Vers la lune Émeraude.\nÉquipage : Mina et Éloi 🚀" };

test("valid import preserves Unicode, line breaks and original whitespace; ignores extra properties", () => {
  const original = { ...card, question: `  ${card.question}\n`, topic: "ignored" };
  assert.deepEqual(parseDeck(JSON.stringify([original])), {
    ok: true, cards: [{ question: original.question, answer: card.answer }], ignored: 0,
  });
});

test("partial import reports exactly 39 accepted and 1 ignored", () => {
  const result = validateDeck([...Array.from({ length: 39 }, () => card), { question: "", answer: "x" }]);
  assert.ok(result.ok);
  assert.equal(result.cards.length, 39);
  assert.equal(result.ignored, 1);
});

for (const [label, text] of [
  ["malformed", "[{"], ["empty file", ""], ["empty array", "[]"],
  ["object root", JSON.stringify({ cards: [card] })], ["null root", "null"],
  ["no valid entries", '[null, 2, {}, {"question":" ","answer":"x"}]'],
] as const) {
  test(`rejects ${label} with a French explanation`, () => {
    const result = parseDeck(text);
    assert.equal(result.ok, false);
    assert.ok(!result.ok && result.message.length > 15);
  });
}

test("rejects invalid entry types, missing fields and whitespace-only strings", () => {
  const invalid = [null, [], 5, "card", {}, { question: 1, answer: "a" },
    { question: "q", answer: false }, { question: "q" }, { answer: "a" },
    { question: "\n\t ", answer: "a" }, { question: "q", answer: "\u00a0" }];
  const result = validateDeck([card, ...invalid]);
  assert.ok(result.ok);
  assert.equal(result.ignored, invalid.length);
  assert.deepEqual(result.cards, [card]);
});

test("keeps duplicate cards and treats HTML, code, URLs and prototype-like keys as text", () => {
  const text = '<img src="https://example.invalid/pixel" onerror="alert(1)">';
  const result = parseDeck(JSON.stringify([{ question: text, answer: "https://example.invalid ${code}" }, card, card]));
  assert.ok(result.ok);
  assert.equal(result.cards[0]?.question, text);
  assert.equal(result.cards.length, 3);
  assert.ok(parseDeck('[{"question":"__proto__","answer":"constructor"}]').ok);
});

test("accepts UTF-8 BOM from text editors", () => {
  assert.ok(parseDeck(`\uFEFF${JSON.stringify([card])}`).ok);
});

test("large root is rejected; oversized card fields are counted as ignored", () => {
  assert.equal(validateDeck(Array.from({ length: MAX_CARDS + 1 }, () => card)).ok, false);
  const result = validateDeck([card, { question: "x".repeat(MAX_TEXT_LENGTH + 1), answer: "a" }]);
  assert.ok(result.ok);
  assert.equal(result.ignored, 1);
});

test("read errors become import errors without rejecting the promise", async () => {
  const result = await readDeck({ size: 1, text: async () => { throw new Error("unreadable"); } });
  assert.ok(!result.ok);
  assert.match(result.message, /Impossible de lire/);
});

test("rejects a large file before reading it", async () => {
  const result = await readDeck({ size: MAX_FILE_BYTES + 1, text: async () => { assert.fail("must not read"); } });
  assert.ok(!result.ok);
  assert.match(result.message, /5 Mio/);
});

test("file reading uses content rather than extension or MIME type", async () => {
  const result = await readDeck({ size: 200, text: async () => JSON.stringify([card]) });
  assert.ok(result.ok);
});
