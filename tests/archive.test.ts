import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ArchivePasswordError, decryptArchive, deriveArchiveKey, encryptArchive, fileBytes,
  parseArchiveContents, parseEncryptedArchive, type ArchiveContents,
} from "../src/archive.ts";

const password = "fictional-archive-password-only";
const pdf = "%PDF-1.4\nfictional archive fixture\n%%EOF\n";
const cards = JSON.stringify([{ question: "A private question?", answer: "A private answer." }]);
const contents: ArchiveContents = { version: 1, id: "fictional-department", files: {
  "cours/example/methods.pdf": { type: "application/pdf", base64: Buffer.from(pdf).toString("base64") },
  "cours/example/cards.json": { type: "application/json", base64: Buffer.from(cards).toString("base64") },
} };

test("StatiCrypt protects PDF and deck bytes, authenticates the bundle and randomizes rebuilds", async () => {
  const encrypted = await encryptArchive(contents, password);
  const key = await deriveArchiveKey(password, encrypted.salt);
  const decrypted = await decryptArchive(encrypted, key);
  assert.deepEqual(decrypted, contents);
  assert.equal(Buffer.from(fileBytes(decrypted.files["cours/example/methods.pdf"]!)).toString(), pdf);
  assert.equal(Buffer.from(fileBytes(decrypted.files["cours/example/cards.json"]!)).toString(), cards);
  const publicBytes = JSON.stringify(encrypted);
  for (const secret of [password, key, pdf, cards, "private answer", contents.files["cours/example/methods.pdf"]!.base64]) {
    assert(!publicBytes.includes(secret));
  }
  await assert.rejects(decryptArchive(encrypted, await deriveArchiveKey("wrong-password", encrypted.salt)), ArchivePasswordError);
  const tampered = { ...encrypted, data: (encrypted.data[0] === "0" ? "1" : "0") + encrypted.data.slice(1) };
  await assert.rejects(decryptArchive(tampered, key), ArchivePasswordError);
  const rebuilt = await encryptArchive(contents, password);
  assert.notEqual(rebuilt.salt, encrypted.salt);
  assert.notEqual(rebuilt.data, encrypted.data);
  await assert.rejects(decryptArchive(rebuilt, key), ArchivePasswordError);
  await assert.rejects(encryptArchive(contents, "short"));
});

test("archive parsing rejects malformed, swapped and unsafe content", () => {
  const envelope = { version: 1, id: "fictional-department", salt: "a".repeat(32), data: "b".repeat(128) };
  assert.deepEqual(parseEncryptedArchive(envelope, envelope.id), envelope);
  for (const invalid of [null, [], { ...envelope, version: 2 }, { ...envelope, salt: "x".repeat(32) },
    { ...envelope, data: "plaintext" }, { ...envelope, data: "a".repeat(127) }]) {
    assert.throws(() => parseEncryptedArchive(invalid, envelope.id));
  }
  assert.throws(() => parseEncryptedArchive(envelope, "another-department"));
  assert.throws(() => parseArchiveContents(contents, "another-department"));
  for (const files of [{}, { "../private.pdf": contents.files["cours/example/methods.pdf"] },
    { "cours/example/cards.json": { type: "application/pdf", base64: "JVBERi0=" } },
    { "cours/example/cards.json": { type: "application/json", base64: Buffer.from("[]").toString("base64") } },
    { "cours/example/methods.pdf": { type: "application/pdf", base64: Buffer.from("not a PDF").toString("base64") } },
    { "cours/example/methods.pdf": { type: "application/pdf", base64: "???=" } }]) {
    assert.throws(() => parseArchiveContents({ ...contents, files }, contents.id));
  }
});
