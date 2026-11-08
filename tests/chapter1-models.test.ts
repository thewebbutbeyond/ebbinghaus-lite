import assert from "node:assert/strict";
import test from "node:test";
import { initialSession, nextSession, sessionIdentity, sessionScenario } from "../src/session-example.ts";
import { collectPhishingData, initialPhishing, nextPhishing, phishingScenario } from "../src/phishing-example.ts";

test("session access uses the server-side association, never the requester's label", () => {
  const sessions = Object.freeze([Object.freeze({ id: "reference-token", identity: "Reference user" })]);
  assert.equal(sessionIdentity(sessions, null), null);
  assert.equal(sessionIdentity(sessions, "unknown"), null);
  assert.equal(sessionIdentity(sessions, "reference-token"), "Reference user");
  const states = sessionScenario();
  assert.equal(states.length, 7);
  assert.deepEqual(states.map(s => [s.userToken !== null, s.attackerToken !== null, s.userIdentity, s.attackerIdentity]), [
    [false, false, null, null], [false, false, null, null], [true, false, null, null],
    [true, false, "Alice", null], [true, true, "Alice", null], [true, true, "Alice", null], [true, true, "Alice", "Alice"],
  ]);
  assert.equal(states[4]!.attackerToken, states[2]!.userToken);
  assert.deepEqual(Object.keys(states[4]!.sessions[0]!).sort(), ["id", "identity"]);
  assert.equal(JSON.stringify(states).includes("mot-de-passe-fictif"), false);
  assert.equal(nextSession({ ...states[5]!, request: { sender: "attacker", token: "unknown" } }).attackerIdentity, null);
  assert.equal(nextSession({ ...states[5]!, sessions: [] }).attackerIdentity, null);
  assert.equal(nextSession(states[6]!), states[6]);
});

test("session transitions preserve earlier snapshots and do not invent an authenticated session", () => {
  const state = initialSession();
  Object.freeze(state.sessions);
  Object.freeze(state);
  const before = JSON.stringify(state);
  assert.equal(nextSession(state).authenticated, true);
  assert.equal(JSON.stringify(state), before);
  assert.equal(nextSession({ ...state, step: 1 }).userToken, null);
  const run = sessionScenario();
  assert.deepEqual(sessionScenario(), run);
  assert.equal(run[3]!.attackerToken, null);
  assert.equal(run[5]!.attackerIdentity, null);
});

test("phishing's four course stages distinguish opening the site from submitting credentials", () => {
  const states = phishingScenario();
  assert.deepEqual(states.map(s => s.courseStep), [0, 1, 2, 3, 4, 4]);
  assert.deepEqual(states.map(s => [s.delivered, s.siteOpen]), [
    [false, false], [false, false], [false, false], [true, false], [true, true], [true, true],
  ]);
  for (const state of states.slice(0, 5)) {
    assert.equal(state.attacker.login, null);
    assert.equal(state.attacker.password, null);
  }
  assert.deepEqual(states[1]!.attacker, { name: "Alice", email: "alice@campus-demo.test", login: null, password: null });
  assert.equal(new URL(states[2]!.bait!.destination).hostname, "campus-assistance.test");
  assert.equal(states[2]!.bait!.displayedUrl, "campus-demo.test/compte");
  assert.equal(states[5]!.attacker.login, states[5]!.victim.login);
  assert.equal(states[5]!.attacker.password, states[5]!.victim.password);
  assert.equal(states[4]!.attacker.password, null);
  assert.equal(nextPhishing(states[5]!), states[5]);
});

test("phishing disclosure is computed from the supplied fictitious data and has prerequisites", () => {
  const state = initialPhishing();
  assert.equal(collectPhishingData(state), state);
  assert.equal(collectPhishingData({ ...state, siteOpen: true }).attacker.password, null);
  const ready = { ...state, delivered: true, siteOpen: true,
    victim: { ...state.victim, login: "other-demo", password: "another-fictional-value" } };
  Object.freeze(ready.attacker);
  Object.freeze(ready.victim);
  Object.freeze(ready);
  const collected = collectPhishingData(ready);
  assert.equal(collected.attacker.login, "other-demo");
  assert.equal(collected.attacker.password, "another-fictional-value");
  assert.equal(ready.attacker.password, null);
  assert.deepEqual(phishingScenario(), phishingScenario());
});
