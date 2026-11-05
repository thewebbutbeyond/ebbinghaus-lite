import assert from "node:assert/strict";
import { test } from "node:test";
import { acceptImport, rate, reveal, start } from "../src/session.ts";
import { decodeSession, restoreSession, saveSession } from "../src/storage.ts";

const ready = acceptImport({ name: "fictif.json", ignored: 0, cards: [{ question: "Q", answer: "A" }] });
const question = start(ready);
const answer = reveal(question);
const completed = rate(answer, "known");

test("all UI states, including final undo, survive a storage round trip", () => {
  for (const session of [{ kind: "empty" } as const, ready, question, answer, completed]) {
    let stored = "";
    assert.equal(saveSession(session, (text) => { stored = text; }), true);
    assert.deepEqual(restoreSession(() => stored), { session, warning: null });
  }
});

test("missing storage starts fresh; unavailable storage returns an explicit warning", () => {
  assert.deepEqual(restoreSession(() => null), { session: { kind: "empty" }, warning: null });
  const unavailable = restoreSession(() => { throw new Error("denied"); });
  assert.equal(unavailable.session.kind, "empty");
  assert.match(unavailable.warning ?? "", /sauvegarde est indisponible/);
  assert.equal(saveSession(question, () => { throw new Error("quota"); }), false);
  assert.equal(question.kind, "question");
});

test("corrupt or incompatible snapshots cannot restore invalid UI states", () => {
  const invalid = ["{", "null", JSON.stringify({ version: 2, session: ready }),
    ...[
      { ...question, queue: [] }, { ...question, queue: [1] },
      { ...question, queue: [0, 0] }, { ...question, queue: ["0"] },
      { ...question, undo: [] }, { ...question, cards: [{}] },
      { ...question, name: 42 }, { ...question, kind: "unknown" },
    ].map((session) => JSON.stringify({ version: 1, session }))];
  for (const text of invalid) {
    assert.equal(decodeSession(text), null);
    const restored = restoreSession(() => text);
    assert.equal(restored.session.kind, "empty");
    assert.match(restored.warning ?? "", /illisible/);
  }
});
