import assert from "node:assert/strict";
import { test } from "node:test";
import { parseDeck } from "../src/import.ts";
import { acceptImport, offerImport, rate, restart, reveal, start, undo, type Session } from "../src/session.ts";

function ready(count = 3) {
  return acceptImport({ name: "fiction.json", ignored: 0,
    cards: Array.from({ length: count }, (_, index) => ({ question: `Q${index}`, answer: `A${index}` })),
  });
}

test("start keeps original order and reveals without changing the queue or counter", () => {
  const session = start(ready());
  assert.ok(session.kind === "question");
  assert.deepEqual(session.queue, [0, 1, 2]);
  const answer = reveal(session);
  assert.ok(answer.kind === "answer");
  assert.strictEqual(answer.queue, session.queue);
  assert.equal(answer.queue.length, 3);
  assert.strictEqual(reveal(answer), answer);
});

test("shuffle uses a permutation, preserves the source deck and is deterministic under test", () => {
  const original = ready(4);
  const session = start(original, true, () => 0);
  assert.ok(session.kind === "question");
  assert.deepEqual(session.queue, [1, 2, 3, 0]);
  assert.deepEqual(original.cards.map((card) => card.question), ["Q0", "Q1", "Q2", "Q3"]);
  for (const random of [() => 0.99, () => 0.5, Math.random]) {
    const shuffled = start(original, true, random);
    assert.ok(shuffled.kind === "question");
    assert.deepEqual([...shuffled.queue].sort(), [0, 1, 2, 3]);
  }
});

test("known removes current card; again moves it to the end without reducing count", () => {
  let session = rate(reveal(start(ready())), "again");
  assert.ok(session.kind === "question");
  assert.deepEqual(session.queue, [1, 2, 0]);
  assert.equal(session.queue.length, 3);
  session = rate(reveal(session), "known");
  assert.ok(session.kind === "question");
  assert.deepEqual(session.queue, [2, 0]);
});

test("ratings before reveal do nothing and cannot skip a second card", () => {
  const question = start(ready());
  assert.strictEqual(rate(question, "known"), question);
  const next = rate(reveal(question), "known");
  assert.strictEqual(rate(next, "known"), next);
});

test("last card rated again returns to question; only known completes", () => {
  const again = rate(reveal(start(ready(1))), "again");
  assert.ok(again.kind === "question");
  assert.deepEqual(again.queue, [0]);
  assert.equal(rate(reveal(again), "known").kind, "complete");
});

for (const rating of ["known", "again"] as const) {
  test(`undo restores the exact prior queue and answer for ${rating}, once only`, () => {
    const before = reveal(start(ready(), true, () => 0));
    assert.ok(before.kind === "answer");
    const after = rate(before, rating);
    const restored = undo(after);
    assert.ok(restored.kind === "answer");
    assert.deepEqual(restored.queue, before.queue);
    assert.equal(restored.undo, null);
    assert.strictEqual(undo(restored), restored);
    assert.deepEqual(before.queue, [1, 2, 0]);
  });
}

test("undo after intervening reveal still restores last rating, and does not stack", () => {
  const first = rate(reveal(start(ready())), "known");
  const second = rate(reveal(first), "again");
  const restored = undo(reveal(second));
  assert.ok(restored.kind === "answer");
  assert.deepEqual(restored.queue, [1, 2]);
  assert.strictEqual(undo(restored), restored);
});

test("undo works from completed screen; subsequent rating completes again", () => {
  const completed = rate(reveal(start(ready(1))), "known");
  assert.equal(completed.kind, "complete");
  const restored = undo(completed);
  assert.ok(restored.kind === "answer");
  assert.deepEqual(restored.queue, [0]);
  assert.equal(rate(restored, "known").kind, "complete");
});

test("full restart restores all cards, asks order again and clears undo", () => {
  const advanced = rate(reveal(start(ready())), "known");
  const reset = restart(advanced);
  assert.equal(reset.kind, "ready");
  assert.strictEqual(undo(reset), reset);
  const all = start(reset);
  assert.ok(all.kind === "question");
  assert.deepEqual(all.queue, [0, 1, 2]);
  const complete = rate(reveal(start(ready(1))), "known");
  assert.equal(restart(complete).kind, "ready");
});

test("bad imports preserve the exact current session, answer and undo", () => {
  const current = reveal(rate(reveal(start(ready())), "known"));
  for (const text of ["{", "[]", "[{}]", "null"]) {
    const proposal = offerImport(current, parseDeck(text), "bad.json");
    assert.strictEqual(proposal.session, current);
    assert.equal(proposal.pending, null);
  }
});

test("valid replacement is staged without changing a session; cancel preserves it; confirm resets it", () => {
  const current = reveal(rate(reveal(start(ready())), "known"));
  const imported = parseDeck('[{"question":"New","answer":"Deck"}]');
  const proposal = offerImport(current, imported, "new.json");
  assert.strictEqual(proposal.session, current);
  assert.ok(proposal.pending);
  // Dismissing the proposal leaves its unchanged session active.
  assert.strictEqual(proposal.session, current);
  const confirmed = acceptImport(proposal.pending);
  assert.equal(confirmed.kind, "ready");
  assert.equal(confirmed.name, "new.json");
  assert.equal(confirmed.cards.length, 1);
  assert.strictEqual(undo(confirmed), confirmed);
});

test("first import and import after completion need no replacement confirmation; ready does", () => {
  const result = parseDeck('[{"question":"Q","answer":"A"}]');
  for (const current of [{ kind: "empty" } as Session, rate(reveal(start(ready(1))), "known")]) {
    const proposed = offerImport(current, result, "new.json");
    assert.equal(proposed.session.kind, "ready");
    assert.equal(proposed.pending, null);
  }
  assert.ok(offerImport(ready(), result, "new.json").pending);
});

test("empty and ready states tolerate irrelevant actions without mutation", () => {
  for (const session of [{ kind: "empty" } as Session, ready()]) {
    assert.strictEqual(rate(session, "again"), session);
    assert.strictEqual(reveal(session), session);
    assert.strictEqual(undo(session), session);
  }
});
