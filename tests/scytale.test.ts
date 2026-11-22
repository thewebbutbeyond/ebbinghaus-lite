import assert from "node:assert/strict";
import test from "node:test";
import { characters, frontFace, strip } from "../src/scytale.ts";

const read = (message: string, spacing: number, faces: number) => frontFace(strip(message, spacing), faces).map(cell => cell.value).join("");

test("the message reads on the front face only when the stick matches the strip", () => {
  const cells = strip("ABC", 3);
  assert.equal(cells.length, 9);
  assert.deepEqual(cells.filter(cell => cell.message).map(cell => [cell.index, cell.value]), [[0, "A"], [3, "B"], [6, "C"]]);
  assert.equal(read("ABC", 3, 3), "ABC");
  assert.notEqual(read("RENDEZVOUS A MIDI", 3, 4), "RENDEZVOUS A MIDI");
  assert.notEqual(read("RENDEZVOUS A MIDI", 4, 3), "RENDEZVOUS A MIDI");
  for (let spacing = 3; spacing <= 8; spacing++) assert.equal(read("RENDEZVOUS A MIDI", spacing, spacing), "RENDEZVOUS A MIDI");
});

test("the strip keeps spaces and graphemes, and settings are validated", () => {
  const source = " é é 👩‍💻 ";
  assert.equal(read(source, 5, 5), source);
  assert.equal(characters("é👩‍💻").length, 2);
  assert.equal(strip("", 3).length, 0);
  for (const bad of [0, 2, 9, 3.5, NaN]) {
    assert.throws(() => strip("abc", bad), RangeError);
    assert.throws(() => frontFace([], bad), RangeError);
  }
  assert.throws(() => strip("a".repeat(81), 3), RangeError);
});
