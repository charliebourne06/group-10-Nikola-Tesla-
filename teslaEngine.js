import { loadEntries } from "./dataLoader.js";
import { normalise, compileKeyword } from "./matching.js";

// Tesla was born 10 July 1856. Used for "how old would I be today".
const BIRTH = { year: 1856, month: 7, day: 10 };

export function ageIfAlive(now = new Date()) {
  const age = now.getFullYear() - BIRTH.year;
  const month = now.getMonth() + 1;
  const hadBirthdayThisYear =
    month > BIRTH.month || (month === BIRTH.month && now.getDate() >= BIRTH.day);
  return hadBirthdayThisYear ? age : age - 1;
}

// Per-conversation state. The engine never mutates the state it is given; it returns
// an updated copy in the result, so the caller decides where to store it.
export function createState() {
  return { lastNodeId: null, rudeStrikes: 0, userName: null, ended: false };
}

// "my name is Sarah" / "call me Sarah" -> stores the name for the rest of the chat
const NAME_PATTERN = /\b(?:my name is|call me)\s+([A-Za-z]{2,20})\b/i;

// Used only if data/ is missing these entries (the validator warns about that)
const FALLBACK_NODE = {
  id: "fallback",
  type: "fallback",
  responses: ["Ask me about my name, my age, my birth date, or my inventions."],
  followUps: []
};
const ENDED_NODE = {
  id: "conversation-ended",
  type: "system",
  responses: ["Mr. Tesla has left the conversation. Please start a new conversation to speak with him again."],
  followUps: []
};

// Builds a conversation engine over validated entries.
//   rng: returns a number in [0, 1) (inject a fixed one in tests)
//   now: returns the current Date (inject a fixed one in tests)
export function createEngine(entries, { rng = Math.random, now = () => new Date() } = {}) {
  const nodes = new Map(entries.map((e) => [e.id, e]));

  const matchable = entries
    .filter((e) => Array.isArray(e.keywords) && e.keywords.length > 0)
    .map((node) => ({ node, matchers: node.keywords.map(compileKeyword) }));

  function pick(list) {
    return list[Math.min(Math.floor(rng() * list.length), list.length - 1)];
  }

  function fill(text, state) {
    return text
      .replaceAll("{ageIfAlive}", String(ageIfAlive(now())))
      .replaceAll("{userName}", state.userName ?? "my friend");
  }

  function followUpsFor(node) {
    return (node.followUps ?? [])
      .map((id) => nodes.get(id))
      .filter(Boolean)
      .map((target) => ({ id: target.id, label: target.label }));
  }

  function build(node, text, state) {
    return {
      reply: fill(text, state),
      nodeId: node.id,
      type: node.type,
      followUps: state.ended ? [] : followUpsFor(node),
      source: node.source ?? null,
      ended: state.ended,
      state
    };
  }

  // Priority first, then the longest matched keyword, then the number of keywords hit.
  // Entries that tie completely are chosen between at random.
  function findBestNode(text) {
    let best = [];
    for (const { node, matchers } of matchable) {
      const hits = matchers.filter((m) => m.regex.test(text));
      if (hits.length === 0) continue;

      const candidate = {
        node,
        priority: node.priority ?? 0,
        longest: Math.max(...hits.map((m) => m.length)),
        count: hits.length
      };
      const diff = best.length === 0
        ? 1
        : candidate.priority - best[0].priority ||
          candidate.longest - best[0].longest ||
          candidate.count - best[0].count;

      if (diff > 0) best = [candidate];
      else if (diff === 0) best.push(candidate);
    }
    return best.length > 0 ? pick(best).node : null;
  }

  function replyFromNode(node, state) {
    const next = { ...state, lastNodeId: node.id };
    let text;

    if (node.escalating) {
      // Each repeat gets the next, firmer response; the last one ends the conversation.
      next.rudeStrikes = state.rudeStrikes + 1;
      text = node.responses[Math.min(next.rudeStrikes, node.responses.length) - 1];
      if (next.rudeStrikes >= node.responses.length) next.ended = true;
    } else {
      text = pick(node.responses);
    }
    return build(node, text, next);
  }

  function endedReply(state) {
    const node = nodes.get("conversation-ended") ?? ENDED_NODE;
    return build(node, pick(node.responses), state);
  }

  // Free-text input from the user
  function respond(userText, state = createState()) {
    if (state.ended) return endedReply(state);

    const nameMatch = NAME_PATTERN.exec(userText);
    if (nameMatch && nodes.has("user-name-given")) {
      const name = nameMatch[1][0].toUpperCase() + nameMatch[1].slice(1).toLowerCase();
      return replyFromNode(nodes.get("user-name-given"), { ...state, userName: name });
    }

    const node = findBestNode(normalise(userText));
    return replyFromNode(node ?? nodes.get("fallback") ?? FALLBACK_NODE, state);
  }

  // A button the user clicked (a follow-up suggestion). Returns null for an unknown
  // or non-selectable id so the API can answer with a 400.
  function respondToNode(nodeId, state = createState()) {
    if (state.ended) return endedReply(state);

    const node = nodes.get(nodeId);
    if (!node || node.type === "system" || typeof node.label !== "string") return null;
    return { ...replyFromNode(node, state), choiceLabel: node.label };
  }

  // Start of a conversation: a greeting plus suggested topics
  function startConversation() {
    const state = createState();
    const node = nodes.get("greeting") ?? FALLBACK_NODE;
    return replyFromNode(node, state);
  }

  return { respond, respondToNode, startConversation };
}

// Default engine over the real data/ folder
const defaultEngine = createEngine(loadEntries());
export const { respond, respondToNode, startConversation } = defaultEngine;

// Kept for older code that expects plain strings; prefer respond() / startConversation().
export function getTeslaReply(userText) {
  return defaultEngine.respond(userText).reply;
}
export function getTeslaGreeting() {
  return defaultEngine.startConversation().reply;
}