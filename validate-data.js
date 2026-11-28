// Usage: npm run validate
import { loadEntries } from "../dataLoader.js";
import { validateEntries } from "../validateData.js";

let entries;
try {
  entries = loadEntries();
} catch (err) {
  console.error(`ERROR ${err.message}`);
  process.exit(1);
}

const { errors, warnings } = validateEntries(entries);

warnings.forEach((w) => console.warn(`WARN  ${w}`));
errors.forEach((e) => console.error(`ERROR ${e}`));

console.log(`\nChecked ${entries.length} entries: ${errors.length} error(s), ${warnings.length} warning(s).`);
process.exit(errors.length > 0 ? 1 : 0);