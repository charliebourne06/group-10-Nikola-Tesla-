# group-10-Nikola-Tesla-
software engineering Nikola Tesla interactive conversational experience
# Writing Tesla's dialogue

All conversation content lives in `data/*.json`. Each file is a JSON array of **entries**.
The engine loads every `.json` file in this folder, so add your own file per topic
(e.g. `data/ethics.json`) to avoid merge conflicts. Run `npm run validate` before every commit.

## Entry format

```json
{
  "id": "tesla-coil",
  "type": "response",
  "label": "What is the Tesla coil?",
  "keywords": ["tesla coil", "coil", "high voltage"],
  "responses": ["Variant one.", "Variant two (one is picked at random)."],
  "source": { "title": "Britannica: Nikola Tesla", "url": "https://www.britannica.com/biography/Nikola-Tesla" },
  "followUps": ["wardenclyffe", "inventions"]
}
```

| Field | Required | Meaning |
|---|---|---|
| `id` | yes | Unique, lowercase words joined by hyphens. **Never rename an id once others link to it.** |
| `type` | yes | `greeting`, `response`, `personality`, `farewell`, `fallback` or `system` |
| `responses` | yes | One or more replies. Several = variety. Written in Tesla's formal first-person voice. |
| `keywords` | yes, except `fallback` and `system` | Words/phrases in the user's message that trigger this entry |
| `label` | if linked from a `followUps` | Button text shown to the user (write it as the user's question) |
| `followUps` | no | Ids of entries offered as buttons after this reply |
| `source` | on factual `response` entries | `{ "title", "url" }` (https), or `null` if there is no factual claim |
| `priority` | no | Higher wins regardless of keyword length (default 0). Used for rude words (100) and greetings (-10). |
| `escalating` | no | `true`: `responses` are used in order on repeated matches; the last one ends the chat |

## Keyword rules

- Whole words only: `age` does not match "message".
- Case and punctuation are ignored: "What's your AGE?!" matches `age`.
- A trailing `*` matches any word starting with that text: `invent*` matches "inventions".
- When several entries match, the one with the **longest matching keyword** wins, so
  `where were you born` beats `born`. Avoid reusing the same keyword in two entries
  (the validator warns about it).

## Placeholders in responses

- `{ageIfAlive}`: Tesla's age if he were alive today (calculated)
- `{userName}`: the name the user gave ("my name is ...")

## Facts and sources

Check every factual claim against a credible source (NFR-08) and record it in `source`.
Tesla knew nothing after January 1943; anything about later events must be clearly
speculative (FR-16).