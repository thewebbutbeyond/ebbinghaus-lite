import assert from "node:assert/strict";
import test from "node:test";
import { characters, decode, encode } from "../src/scytale.ts";

test("scytale's independent teaching vectors define writing, unrolling and reading", () => {
  const encoded = encode("ABCDEF", 2);
  assert.deepEqual(encoded.grid.map(row => row.map(cell => cell?.value)), [["A", "B", "C"], ["D", "E", "F"]]);
  assert.deepEqual(encoded.tape.map(cell => cell.id), [0, 3, 1, 4, 2, 5]);
  assert.equal(encoded.tape.map(cell => cell.value).join(""), "ADBECF");
  assert.equal(decode(encoded.tape, 2).message, "ABCDEF");
  assert.equal(decode(encoded.tape, 3).message, "AEDCBF");
  assert.equal(encode("ABCDE", 2).tape.map(cell => cell.value ?? "_").join(""), "ADBEC_");
  assert.equal(decode(encode("AAAAAA", 2).tape, 3).message, "AAAAAA");
});

test("scytale preserves every character and its original position across all supported dimensions", () => {
  const source = " AéA e\u0301 👩‍💻Z";
  for (let length = 0; length <= 80; length++) {
    const letters = Array.from({ length }, (_, i) => String.fromCodePoint(0x41 + i % 26));
    const message = letters.join("");
    for (let rows = 2; rows <= 8; rows++) {
      const encrypted = encode(message, rows);
      const width = Math.ceil(length / rows);
      // Independent index oracle, without the model's grid construction.
      for (let i = 0; i < length; i++) {
        assert.equal(encrypted.tape[(i % width) * rows + Math.floor(i / width)]!.value, letters[i]);
      }
      assert.equal(decode(encrypted.tape, rows).message, message);
      assert.equal(new Set(encrypted.tape.map(cell => cell.id)).size, encrypted.tape.length);
      assert.deepEqual(encrypted.tape.filter(cell => cell.value !== null).map(cell => cell.value).sort(), [...letters].sort());
    }
  }
  for (let rows = 2; rows <= 8; rows++) {
    const encrypted = encode(source, rows);
    assert.equal(decode(encrypted.tape, rows).message, source);
    for (let reading = 2; reading <= 8; reading++) {
      const rearranged = decode(encrypted.tape, reading);
      const cells = rearranged.grid.flat().filter(cell => cell !== null);
      assert.deepEqual(cells.map(cell => cell.id).sort((a, b) => a - b), encrypted.tape.map(cell => cell.id).sort((a, b) => a - b));
    }
  }
  assert.equal(characters("e\u0301👩‍💻").length, 2);
});

test("scytale handles blanks, padding, validation and frozen inputs without silent normalization", () => {
  assert.equal(decode(encode("  ", 3).tape, 3).message, "  ");
  assert.equal(encode("", 2).tape.length, 0);
  assert.equal(decode([], 2).message, "");
  for (const bad of [0, 1, 9, 2.5, NaN, Infinity]) {
    assert.throws(() => encode("abc", bad), RangeError);
    assert.throws(() => decode([], bad), RangeError);
  }
  assert.throws(() => encode("a".repeat(81), 3), RangeError);
  const encoded = encode("A A", 2);
  const tape = Object.freeze(encoded.tape.map(cell => Object.freeze(cell)));
  const before = JSON.stringify(tape);
  assert.equal(decode(tape, 2).message, "A A");
  assert.equal(JSON.stringify(tape), before);
});
