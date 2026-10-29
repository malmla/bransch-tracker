import { isFilled, normalizeName } from "../utils/text.js";

export const FILTER_FIELDS = ["company", "contactPerson", "email", "phone"];

export const createFilters = () => Object.fromEntries(FILTER_FIELDS.map((f) => [f, ""]));

export const isFiltering = (filters) => Object.values(filters).some(Boolean);

/** Filters combine with AND. Company searches by substring; other modes are "", "has", or "missing". */
export function matchesFilters(app, filters) {
  for (const field of FILTER_FIELDS) {
    const mode = filters[field];
    if (field === "company") {
      if (mode && !normalizeName(app.company).includes(normalizeName(mode))) return false;
      continue;
    }
    if (mode && (mode === "has") !== isFilled(app[field])) return false;
  }
  return true;
}
