// Text matching helpers shared by the engine and the data validator.

// Lower-cases, drops apostrophes, turns any other punctuation into spaces and
// collapses whitespace, so "What's your AGE?!" becomes "whats your age".
export function normalise(text) {
  return String(text)
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Compiles one keyword into a matcher.
//   "age"      matches the whole word "age" only (not "message")
//   "invent*"  matches any word starting with "invent" (invent, inventions...)
//   "how old"  matches the whole phrase
export function compileKeyword(keyword) {
  const isPrefix = keyword.trim().endsWith("*");
  const base = normalise(isPrefix ? keyword.trim().slice(0, -1) : keyword);
  const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return {
    keyword,
    length: base.length,
    regex: new RegExp(`(^| )${escaped}${isPrefix ? "[a-z0-9]*" : ""}( |$)`)
  };
}