import { isFilled } from "../utils/text.js";

export const FILTER_FIELDS = ["contactPerson", "email", "phone"];

export const createFilters = () => Object.fromEntries(FILTER_FIELDS.map((f) => [f, ""]));

export const isFiltering = (filters) => Object.values(filters).some(Boolean);

/** Filters combine with AND. Modes: "" (any), "has", "missing". */
export function matchesFilters(app, filters) {
  for (const field of FILTER_FIELDS) {
    const mode = filters[field];
    if (mode && (mode === "has") !== isFilled(app[field])) return false;
  }
  return true;
}
