import assert from "node:assert/strict";
import test from "node:test";
import { advance, configure, createTimeline, current } from "../src/ddos.ts";

// Independent scalar oracle: no use of the model's FIFO or tally helpers.
test("all supported loads obey capacity, finite-buffer conservation and origin totals", () => {
  for (let bots = 0; bots <= 12; bots++) {
    for (let rate = 1; rate <= 8; rate++) {
      for (let capacity = 1; capacity <= 32; capacity++) {
        let timeline = configure(createTimeline(), { bots, rate, capacity, attack: true });
        let backlog = 0;
        let arrivalsTotal = 0;
        let processedTotal = 0;
        let droppedTotal = 0;
        for (let second = 1; second <= 6; second++) {
          const offered = 4 + bots * rate;
          const serviced = Math.min(capacity, backlog + offered);
          const rejected = Math.max(0, backlog + offered - serviced - 200);
          backlog = Math.min(200, Math.max(0, backlog + offered - capacity));
          arrivalsTotal += offered;
          processedTotal += serviced;
          droppedTotal += rejected;
          timeline = advance(timeline);
          const state = current(timeline);
          assert.equal(state.time, second);
          assert.deepEqual(state.arrived, { normal: 4, attack: bots * rate });
          assert.equal(state.queue.length, backlog);
          assert.equal(state.processed.normal + state.processed.attack, serviced);
          assert.equal(state.dropped.normal + state.dropped.attack, rejected);
          assert.equal(arrivalsTotal - processedTotal - droppedTotal, backlog);
          for (const origin of ["normal", "attack"] as const) {
            const pending = state.queue.filter(request => request.kind === origin).length;
            assert.equal(state.totals.arrived[origin] - state.totals.processed[origin] -
              state.totals.dropped[origin], pending);
            assert.ok(state.processed[origin] >= 0 && state.dropped[origin] >= 0);
          }
          for (let i = 1; i < state.queue.length; i++) {
            assert.ok(state.queue[i - 1]!.at <= state.queue[i]!.at);
          }
        }
      }
    }
  }
});
