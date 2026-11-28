import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "data");

// Loads every data/*.json file (each must be a JSON array of conversation nodes)
// and merges them. Splitting content across files lets teammates write content in
// parallel without merge conflicts. Each entry remembers its file in `_file` so the
// validator can point at the right place.
export function loadEntries(dir = DATA_DIR) {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
  const entries = [];

  for (const file of files) {
    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(path.join(dir, file), "utf-8"));
    } catch (err) {
      throw new Error(`Could not read data/${file}: ${err.message}`);
    }
    if (!Array.isArray(parsed)) {
      throw new Error(`data/${file} must contain a JSON array`);
    }
    for (const entry of parsed) {
      entries.push({ ...entry, _file: file });
    }
  }
  return entries;
}