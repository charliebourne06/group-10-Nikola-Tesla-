import { test } from "node:test";
import assert from "node:assert/strict";
import { createEngine, createState, ageIfAlive } from "../teslaEngine.js";
import { loadEntries } from "../dataLoader.js";

// Small fixture so the matching rules are tested independently of real content
const fixture = [
  { id: "greeting", type: "greeting", priority: -10, keywords: ["hi"], responses: ["Greetings."], followUps: ["age"] },
  { id: "fallback", type: "fallback", responses: ["Pardon?"], followUps: ["age"] },
  { id: "age", type: "response", label: "How old are you?", keywords: ["age"], responses: ["Old."], source: null, followUps: ["born"] },
  { id: "born", type: "response", label: "Where born?", keywords: ["born", "where were you born"], responses: ["Smiljan."], source: null },
  { id: "invent", type: "response", label: "Inventions?", keywords: ["invent*"], responses: ["Many."], source: null },
  { id: "water", type: "response", label: "Water?", keywords: ["war of currents", "water"], responses: ["Water."], source: null },
  {
    id: "rude", type: "personality", priority: 100, escalating: true,
    keywords: ["fuck*"], responses: ["Warning one.", "Warning two.", "Goodbye."]
  },
  { id: "user-name-given", type: "system", responses: ["Hello {userName}."] },
  { id: "conversation-ended", type: "system", responses: ["Left."] }
];

const fixed = { rng: () => 0, now: () => new Date("2026-11-28T12:00:00") };
const engine = createEngine(fixture, fixed);

test("matches whole words only: 'message' does not trigger 'age'", () => {
  assert.equal(engine.respond("I sent a message").nodeId, "fallback");
  assert.equal(engine.respond("what is your age?").nodeId, "age");
});

test("matching ignores case and punctuation", () => {
  assert.equal(engine.respond("WHAT'S YOUR AGE?!").nodeId, "age");
});

test("the longest matched keyword wins", () => {
  assert.equal(engine.respond("where were you born").nodeId, "born");
});

test("a trailing * matches any word with that prefix", () => {
  assert.equal(engine.respond("tell me about your inventions").nodeId, "invent");
});

test("priority beats keyword length (rude words win over topics)", () => {
  assert.equal(engine.respond("what the fuck is the war of currents").nodeId, "rude");
});

test("unmatched input returns the fallback with suggested topics", () => {
  const result = engine.respond("xyzzy");
  assert.equal(result.nodeId, "fallback");
  assert.deepEqual(result.followUps, [{ id: "age", label: "How old are you?" }]);
});

test("replies include resolved follow-up buttons", () => {
  const result = engine.respond("age");
  assert.deepEqual(result.followUps, [{ id: "born", label: "Where born?" }]);
});

test("startConversation greets and offers topics", () => {
  const result = engine.startConversation();
  assert.equal(result.reply, "Greetings.");
  assert.equal(result.followUps.length, 1);
});

test("respondToNode handles a clicked follow-up and rejects unknown or system ids", () => {
  const ok = engine.respondToNode("born");
  assert.equal(ok.reply, "Smiljan.");
  assert.equal(ok.choiceLabel, "Where born?");
  assert.equal(engine.respondToNode("nope"), null);
  assert.equal(engine.respondToNode("user-name-given"), null);
});

test("remembers the user's name for the rest of the conversation", () => {
  const result = engine.respond("my name is sarah");
  assert.equal(result.reply, "Hello Sarah.");
  assert.equal(result.state.userName, "Sarah");
});

test("rude input escalates, then ends the conversation, then stays ended", () => {
  const start = createState();
  const first = engine.respond("fuck", start);
  const second = engine.respond("fuck", first.state);
  const third = engine.respond("fuck", second.state);
  const after = engine.respond("what is your age", third.state);

  assert.equal(first.reply, "Warning one.");
  assert.equal(second.reply, "Warning two.");
  assert.equal(third.reply, "Goodbye.");
  assert.equal(third.ended, true);
  assert.deepEqual(third.followUps, []);
  assert.equal(after.reply, "Left.");
  assert.equal(start.rudeStrikes, 0, "the original state object must not be mutated");
});

test("ageIfAlive accounts for whether the birthday has passed (born 10 July 1856)", () => {
  assert.equal(ageIfAlive(new Date("2026-07-09T12:00:00")), 169);
  assert.equal(ageIfAlive(new Date("2026-07-10T12:00:00")), 170);
  assert.equal(ageIfAlive(new Date("2026-11-28T12:00:00")), 170);
});

// Smoke tests against the real content in data/
const real = createEngine(loadEntries(), fixed);

test("real data: common questions reach the expected entries", () => {
  assert.equal(real.respond("how old are you?").nodeId, "age");
  assert.equal(real.respond("Where were you born?").nodeId, "early-life");
  assert.equal(real.respond("what is the tesla coil").nodeId, "tesla-coil");
  assert.equal(real.respond("what did you invent?").nodeId, "inventions");
  assert.equal(real.respond("hello").nodeId, "greeting");
});

test("real data: the age answer shows the current age, not a hardcoded one", () => {
  assert.match(real.respond("how old are you").reply, /170 years old/);
});