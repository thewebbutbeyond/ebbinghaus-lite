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

test("padding: the course message gives 11 blocks, padding only on the last", async () => {
  const { BLOCK_SIZE, encode, PADDING_MESSAGE, toBlocks } = await import("../src/padding-example.ts");
  const blocks = toBlocks(encode(PADDING_MESSAGE));
  assert.equal(blocks.length, 11);
  assert.ok(blocks.every(block => block.bytes.length === BLOCK_SIZE));
  assert.deepEqual(blocks.map(block => block.padding), [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11]);
  assert.deepEqual(blocks.at(-1)!.bytes.slice(-11), Array(11).fill(11));
  assert.equal(toBlocks(encode(PADDING_MESSAGE), BLOCK_SIZE, false).at(-1)!.bytes.length, 5);
});

test("padding: PKCS#7 round-trips every length and adds a full block when the message fits exactly", async () => {
  const { pad, unpad } = await import("../src/padding-example.ts");
  for (const size of [8, 16, 32]) for (let length = 0; length <= 3 * size; length++) {
    const bytes = Uint8Array.from({ length }, (_, n) => n % 256);
    const padded = pad(bytes, size);
    assert.equal(padded.length % size, 0);
    assert.equal(padded.length - length, size - (length % size));
    assert.deepEqual(unpad(padded, size), bytes);
  }
  assert.equal(unpad(Uint8Array.from([1, 2, 3, 0]), 4), null);
  assert.equal(unpad(Uint8Array.from([1, 2, 3, 3]), 4), null);
  assert.equal(unpad(Uint8Array.from([1, 2, 3]), 4), null);
});

test("shared key: Bob decrypts with the shared key, Eve's guess fails, the ciphertext hides the text", async () => {
  const { decrypt, encrypt, EVE_GUESS, SHARED_KEY_MESSAGE, SHARED_SECRET, toHex } = await import("../src/shared-key-example.ts");
  const cipher = await encrypt(SHARED_SECRET, SHARED_KEY_MESSAGE);
  assert.equal(cipher.length, new TextEncoder().encode(SHARED_KEY_MESSAGE).length + 16);
  assert.equal(await decrypt(SHARED_SECRET, cipher), SHARED_KEY_MESSAGE);
  assert.equal(await decrypt(EVE_GUESS, cipher), null);
  assert.ok(!new TextDecoder("utf-8", { fatal: false }).decode(cipher).includes("Bob"));
  assert.ok(!toHex(cipher).includes(toHex(new TextEncoder().encode("Bob"))));
  const altered = cipher.slice();
  altered[0] = altered[0]! ^ 1;
  assert.equal(await decrypt(SHARED_SECRET, altered), null);
});
