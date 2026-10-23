import { normalizeName } from "../utils/text.js";

/**
 * Splits imported rows into brand new companies and conflicts with existing ones.
 * Companies are matched by name, ignoring case and extra whitespace.
 */
export function planImport(existing, imported) {
  const byName = new Map();
  for (const app of existing) {
    const key = normalizeName(app.company);
    if (key && !byName.has(key)) byName.set(key, app);
  }
  const fresh = [];
  const conflicts = [];
  for (const row of imported) {
    const match = byName.get(normalizeName(row.company));
    if (match) conflicts.push({ existing: match, row });
    else fresh.push(row);
  }
  return { fresh, conflicts };
}
