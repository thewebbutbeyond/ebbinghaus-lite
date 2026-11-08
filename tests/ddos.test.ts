import assert from "node:assert/strict";
import test from "node:test";
import { advance, configure, createTimeline, current, DEFAULT_SETTINGS, MAX_TIME,
  previous, QUEUE_LIMIT, type Settings } from "../src/ddos.ts";

test("defaults and bounds are explicit; invalid settings fail before changing state", () => {
  const timeline = createTimeline();
  assert.deepEqual(DEFAULT_SETTINGS, { bots: 6, rate: 2, capacity: 8, attack: false });
  assert.equal(MAX_TIME, 120);
  assert.equal(QUEUE_LIMIT, 200);
  assert.equal(current(timeline).time, 0);
  assert.deepEqual(current(timeline).queue, []);
  for (const patch of [
    { bots: -1 }, { bots: 13 }, { bots: 0.5 }, { bots: NaN },
    { rate: 0 }, { rate: 9 }, { rate: Infinity },
    { capacity: 0 }, { capacity: 33 }, { capacity: 3.5 },
    { attack: 1 }, { attack: "false" }, { rate: undefined },
  ]) {
    assert.throws(() => configure(timeline, patch as Partial<Settings>), RangeError);
  }
  assert.deepEqual(timeline.settings, DEFAULT_SETTINGS);
  assert.equal(previous(timeline), timeline);
});

test("reference normal, attack and recovery states include both request origins", () => {
  let timeline = advance(createTimeline());
  assert.deepEqual(current(timeline).arrived, { normal: 4, attack: 0 });
  assert.deepEqual(current(timeline).processed, { normal: 4, attack: 0 });
  assert.equal(current(timeline).queue.length, 0);
  timeline = advance(configure(timeline, { attack: true }));
  assert.deepEqual(current(timeline).arrived, { normal: 4, attack: 12 });
  assert.deepEqual(current(timeline).processed, { normal: 2, attack: 6 });
  assert.equal(current(timeline).queue.length, 8);
  timeline = advance(configure(timeline, { attack: false }));
  assert.deepEqual(current(timeline).processed, { normal: 2, attack: 6 });
  assert.equal(current(timeline).queue.length, 4);
  timeline = advance(timeline);
  assert.equal(current(timeline).queue.length, 0);
  assert.deepEqual(current(timeline).totals.arrived, { normal: 16, attack: 12 });
  assert.deepEqual(current(timeline).totals.processed, { normal: 16, attack: 12 });
  assert.deepEqual(current(timeline).totals.dropped, { normal: 0, attack: 0 });
});

test("FIFO preserves old work; overflow discards newest work", () => {
  let timeline = configure(createTimeline(), { bots: 12, rate: 8, capacity: 1, attack: true });
  timeline = advance(timeline);
  assert.equal(current(timeline).queue.length, 99);
  assert.deepEqual(current(timeline).queue[0], { kind: "attack", source: 0, at: 1 });
  timeline = advance(timeline);
  assert.equal(current(timeline).queue.length, 198);
  const previouslyQueued = current(timeline).queue.slice(1);
  timeline = advance(timeline);
  const state = current(timeline);
  assert.equal(state.queue.length, 200);
  assert.deepEqual(state.queue.slice(0, previouslyQueued.length), previouslyQueued);
  assert.equal(state.dropped.normal + state.dropped.attack, 97);
  assert.equal(state.queue.at(-1)!.at, 3);
});

test("rewind restores settings; replay reuses the exact recorded snapshot", () => {
  let timeline = advance(configure(createTimeline(), { attack: true }));
  const first = current(timeline);
  timeline = advance(configure(timeline, { capacity: 32, attack: false }));
  const second = current(timeline);
  const rewind = previous(timeline);
  assert.strictEqual(current(rewind), first);
  assert.deepEqual(rewind.settings, first.settings);
  const replay = advance(rewind);
  assert.strictEqual(current(replay), second);
  assert.deepEqual(replay.settings, second.settings);
  const unchanged = configure(rewind, { bots: rewind.settings.bots });
  assert.strictEqual(unchanged, rewind);
  assert.strictEqual(current(advance(unchanged)), second);
});

test("branching preserves selected work, discards only future, applies inputs next tick", () => {
  let timeline = advance(configure(createTimeline(), { attack: true }));
  timeline = advance(timeline);
  const rewind = previous(timeline);
  const selected = current(rewind);
  const branch = configure(rewind, { capacity: 32 });
  assert.strictEqual(current(branch), selected);
  assert.strictEqual(branch.history[0], rewind.history[0]);
  assert.equal(branch.history.length, 2);
  assert.equal(selected.queue.length, 8);
  assert.equal(selected.settings.capacity, 8);
  assert.equal(branch.settings.capacity, 32);
  const advanced = advance(branch);
  assert.equal(current(advanced).queue.length, 0);
  assert.deepEqual(current(advanced).processed, { normal: 6, attack: 18 });
  assert.equal(current(timeline).queue.length, 16);
});

function freeze(value: unknown): void {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const item of Object.values(value)) freeze(item);
  }
}

test("transitions accept frozen inputs and reset creates a fresh clean history", () => {
  const initial = createTimeline();
  freeze(initial);
  const attacked = advance(configure(initial, { attack: true }));
  freeze(attacked);
  const later = advance(attacked);
  assert.equal(current(later).queue.length, 16);
  assert.equal(current(attacked).queue.length, 8);
  assert.equal(current(initial).time, 0);
  const reset = createTimeline();
  assert.deepEqual(reset, initial);
  assert.notStrictEqual(reset, initial);
});

test("time stops at 120 seconds and history remains navigable", () => {
  let timeline = createTimeline();
  for (let i = 0; i < 120; i++) timeline = advance(timeline);
  assert.equal(current(timeline).time, 120);
  assert.equal(timeline.history.length, 121);
  assert.strictEqual(advance(timeline), timeline);
  const rewind = previous(timeline);
  assert.equal(current(rewind).time, 119);
  assert.strictEqual(current(advance(rewind)), current(timeline));
  const branch = advance(configure(rewind, { capacity: 1 }));
  assert.equal(current(branch).time, 120);
  assert.equal(current(branch).queue.length, 3);
});
