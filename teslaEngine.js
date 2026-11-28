import fs from "fs";
import path from "path";

const TESLA_DATA_FILE = path.resolve("./tesla_Data.json");

function loadTeslaResponses() {
    try {
        const raw = fs.readFileSync(TESLA_DATA_FILE, "utf-8");
        const items = JSON.parse(raw);
        if(!Array.isArray(items)) return [];
        
        return items.filter(
            (entry) =>
                entry &&
            typeof entry.text === "string" &&
            entry.text.trim() !== "" &&
            entry.text.trim().toLowerCase() !== "insert line of text here"
        );
        
    } catch (err) {
        console.error("Error loading Tesla responses:", err.message);
        return [];
    }
}
const teslaEntries = loadTeslaResponses();

function pickWeighted(entries) {
  if (!entries.length) return null;

  const totalWeight = entries.reduce((sum, item) => {
    const prob = typeof item.probability === "number" && item.probability > 0 ? item.probability : 1;
    return sum + prob;
  }, 0);

  let roll = Math.random() * totalWeight;
  for (const item of entries) {
    const prob = typeof item.probability === "number" && item.probability > 0 ? item.probability : 1;
    roll -= prob;
    if (roll <= 0) return item;
  }
  return entries[entries.length - 1];
}

export function getTeslaReply(userText) {
  const cleaned = userText.toLowerCase();

  // 1. Match non-empty topics (longest phrase first, e.g. "fuck you" before "fuck")
  const topicEntries = teslaEntries
    .filter((item) => typeof item.topics === "string" && item.topics.trim() !== "")
    .sort((a, b) => b.topics.trim().length - a.topics.trim().length);

  const matchedTopicEntries = topicEntries.filter((item) => {
    const topic = item.topics.trim().toLowerCase();
    const escaped = topic.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i");
    return regex.test(cleaned);
  });

  if (matchedTopicEntries.length > 0) {
    const bestTopicLength = matchedTopicEntries[0].topics.trim().length;
    const topMatches = matchedTopicEntries.filter(
      (item) => item.topics.trim().length === bestTopicLength
    );
    const chosen = pickWeighted(topMatches);
    if (chosen) return chosen.text;
  }

  // 2. Fallback to greeting or general prompt
  const isGreeting = /\b(hi|hello|hey|greetings|good day|morning|evening)\b/i.test(cleaned);
  if (isGreeting) {
    const greetings = teslaEntries.filter((item) => item.type === "greeting");
    const chosen = pickWeighted(greetings);
    if (chosen) return chosen.text;
  }

  const prompts = teslaEntries.filter((item) => item.type === "prompts");
  const chosenPrompt = pickWeighted(prompts);
  if (chosenPrompt) return chosenPrompt.text;

  return "Ask me about my name, age, birth date, or numbers.";
}
