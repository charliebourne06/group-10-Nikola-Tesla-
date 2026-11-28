import { normalise } from "./matching.js";

const TYPES = ["greeting", "response", "personality", "farewell", "fallback", "system"];
const NEEDS_KEYWORDS = ["greeting", "response", "personality", "farewell"];
const KNOWN_PLACEHOLDERS = ["ageIfAlive", "userName"];
const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Checks the conversation data against the schema in data/README.md.
// Returns { errors, warnings }. Errors must be fixed; warnings are advice.
export function validateEntries(entries) {
  const errors = [];
  const warnings = [];

  if (!Array.isArray(entries) || entries.length === 0) {
    return { errors: ["No conversation entries were loaded."], warnings };
  }

  const where = (e) => `${e._file ?? "data"} > ${e.id ?? "(no id)"}`;
  const byId = new Map();

  // Pass 1: ids and per-entry structure
  for (const e of entries) {
    if (typeof e.id !== "string" || !ID_PATTERN.test(e.id)) {
      errors.push(`${where(e)}: id must be lowercase words joined by hyphens (e.g. "tesla-coil")`);
    } else if (byId.has(e.id)) {
      errors.push(`${where(e)}: duplicate id "${e.id}" (also in ${byId.get(e.id)._file})`);
    } else {
      byId.set(e.id, e);
    }

    if (!TYPES.includes(e.type)) {
      errors.push(`${where(e)}: type must be one of ${TYPES.join(", ")}`);
    }

    if (!Array.isArray(e.responses) || e.responses.length === 0) {
      errors.push(`${where(e)}: responses must be a non-empty array`);
    } else {
      e.responses.forEach((text, i) => {
        if (typeof text !== "string" || text.trim() === "") {
          errors.push(`${where(e)}: responses[${i}] is empty`);
          return;
        }
        if (text.trim().toLowerCase() === "insert line of text here") {
          errors.push(`${where(e)}: responses[${i}] is still the placeholder text`);
        }
        for (const match of text.matchAll(/\{(\w+)\}/g)) {
          if (!KNOWN_PLACEHOLDERS.includes(match[1])) {
            errors.push(`${where(e)}: responses[${i}] uses unknown placeholder {${match[1]}}`);
          }
        }
      });
    }

    if (NEEDS_KEYWORDS.includes(e.type)) {
      if (!Array.isArray(e.keywords) || e.keywords.length === 0) {
        errors.push(`${where(e)}: ${e.type} entries need a non-empty keywords array`);
      } else {
        e.keywords.forEach((k, i) => {
          if (typeof k !== "string" || normalise(k.replace(/\*$/, "")) === "") {
            errors.push(`${where(e)}: keywords[${i}] is empty or invalid`);
          }
        });
      }
    }

    if (e.label !== undefined && (typeof e.label !== "string" || e.label.trim() === "")) {
      errors.push(`${where(e)}: label must be a non-empty string`);
    }
    if (e.priority !== undefined && typeof e.priority !== "number") {
      errors.push(`${where(e)}: priority must be a number`);
    }
    if (e.escalating !== undefined && typeof e.escalating !== "boolean") {
      errors.push(`${where(e)}: escalating must be true or false`);
    }

    if (e.source !== undefined && e.source !== null) {
      const ok =
        typeof e.source.title === "string" && e.source.title.trim() !== "" &&
        typeof e.source.url === "string" && e.source.url.startsWith("https://");
      if (!ok) errors.push(`${where(e)}: source must be null or { "title": "...", "url": "https://..." }`);
    } else if (e.source === undefined && e.type === "response") {
      warnings.push(`${where(e)}: no "source" field (add a source, or "source": null if it makes no factual claim)`);
    }
  }

  // Pass 2: links between entries
  for (const e of entries) {
    if (e.followUps === undefined) continue;
    if (!Array.isArray(e.followUps)) {
      errors.push(`${where(e)}: followUps must be an array of ids`);
      continue;
    }
    for (const targetId of e.followUps) {
      const target = byId.get(targetId);
      if (!target) {
        errors.push(`${where(e)}: followUps points to unknown id "${targetId}"`);
      } else if (target.id === e.id) {
        warnings.push(`${where(e)}: followUps points to itself`);
      } else if (target.type === "system") {
        errors.push(`${where(e)}: followUps cannot point to system entry "${targetId}"`);
      } else if (typeof target.label !== "string" || target.label.trim() === "") {
        errors.push(`${where(e)}: followUps target "${targetId}" has no label to show on its button`);
      }
    }
  }

  // Required entries
  if (!entries.some((e) => e.id === "greeting" && e.type === "greeting")) {
    errors.push('Missing required entry: id "greeting" with type "greeting"');
  }
  if (!entries.some((e) => e.id === "fallback" && e.type === "fallback")) {
    errors.push('Missing required entry: id "fallback" with type "fallback"');
  }
  for (const id of ["user-name-given", "conversation-ended"]) {
    if (!byId.has(id)) warnings.push(`Missing system entry "${id}" (the engine will use a built-in default)`);
  }

  // Ambiguity check: the same keyword used by two entries
  const keywordOwners = new Map();
  for (const e of entries) {
    for (const k of Array.isArray(e.keywords) ? e.keywords : []) {
      if (typeof k !== "string") continue;
      const key = normalise(k.replace(/\*$/, "")) + (k.trim().endsWith("*") ? "*" : "");
      if (!keywordOwners.has(key)) keywordOwners.set(key, []);
      keywordOwners.get(key).push(e.id);
    }
  }
  for (const [key, owners] of keywordOwners) {
    const unique = [...new Set(owners)];
    if (unique.length > 1) {
      warnings.push(`Keyword "${key}" is used by several entries (${unique.join(", ")}); one is picked at random`);
    }
  }

  return { errors, warnings };
}