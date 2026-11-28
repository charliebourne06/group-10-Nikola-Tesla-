import { test } from "node:test";
import assert from "node:assert/strict";
import { loadEntries } from "../dataLoader.js";
import { validateEntries } from "../validateData.js";

test("conversation data in data/ passes validation (TR-08: unique ids, valid targets)", () => {
  const { errors } = validateEntries(loadEntries());
  assert.deepEqual(errors, [], `Data errors:\n${errors.join("\n")}`);
});

test("validator catches duplicate ids, broken follow-ups and placeholder text", () => {
  const bad = [
    { id: "greeting", type: "greeting", keywords: ["hi"], responses: ["Hello."] },
    { id: "fallback", type: "fallback", responses: ["Pardon?"] },
    { id: "a", type: "response", label: "A", keywords: ["a"], responses: ["insert line of text here"], source: null, followUps: ["missing"] },
    { id: "a", type: "response", keywords: ["b"], responses: ["Hi {nope}."], source: null }
  ];
  const { errors } = validateEntries(bad);
  assert.ok(errors.some((e) => e.includes("duplicate id")));
  assert.ok(errors.some((e) => e.includes("unknown id")));
  assert.ok(errors.some((e) => e.includes("placeholder text")));
  assert.ok(errors.some((e) => e.includes("unknown placeholder")));
});