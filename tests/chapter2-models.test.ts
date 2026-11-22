import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { compareHashes, initialWill, nextWill, sha256Hex, willScenario, WILL_STEPS, WILL_TEXT } from "../src/will-example.ts";

const reference = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");

test("the will hash is a real SHA-256 and matches an independent implementation", async () => {
  assert.equal(await sha256Hex(""), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  assert.equal(await sha256Hex(WILL_TEXT.original), reference(WILL_TEXT.original));
  assert.notEqual(await sha256Hex(WILL_TEXT.original), await sha256Hex(WILL_TEXT.altered));
});

test("the scenario detects George's change only at the final comparison", async () => {
  const states = await willScenario();
  assert.equal(states.length, WILL_STEPS + 1);
  assert.deepEqual(states.map(s => s.verdict), [null, null, null, null, null, null, "altered"]);
  assert.equal(states[3]!.notaryA, WILL_TEXT.original);
  assert.equal(states[3]!.notaryB, reference(WILL_TEXT.original));
  assert.equal(states[4]!.notaryA, WILL_TEXT.altered);
  assert.equal(states[4]!.notaryB, states[3]!.notaryB);
  assert.equal(states[5]!.readingHash, reference(WILL_TEXT.altered));
  assert.equal(JSON.stringify(states.map(s => s.notaryB)).includes("George"), false);
  assert.equal(await nextWill(states[WILL_STEPS]!), states[WILL_STEPS]);
});

test("comparison restores a match when the original text is presented", async () => {
  const kept = await sha256Hex(WILL_TEXT.original);
  assert.equal(compareHashes(await sha256Hex(WILL_TEXT.original), kept), "intact");
  assert.equal(compareHashes(await sha256Hex(WILL_TEXT.original + " "), kept), "altered");
  assert.equal(compareHashes(null, kept), null);
  const frozen = Object.freeze(initialWill());
  const before = JSON.stringify(frozen);
  await nextWill(frozen);
  assert.equal(JSON.stringify(frozen), before);
});
