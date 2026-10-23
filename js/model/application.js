import { newId } from "../utils/id.js";
import { isFilled, isValidEmail } from "../utils/text.js";

export const FIELDS = ["rank", "company", "city", "contactPerson", "email", "phone", "motivation", "notes"];
export const TEXT_FIELDS = FIELDS.filter((f) => f !== "rank");
export const REQUIRED_FIELDS = ["company"];
export const OPTIONAL_CONTACT_FIELDS = ["rank", "city", "contactPerson", "email", "phone"];

const text = (value) => String(value ?? "").trim();
const UUID_V4 = /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i;

/** Returns null for empty, NaN for invalid, otherwise an integer >= 1. */
export function parseRank(value) {
  const s = text(value);
  if (!s) return null;
  const n = Number(s);
  return Number.isInteger(n) && n >= 1 ? n : NaN;
}

/** Trims text fields and converts rank; an invalid rank becomes null. */
export function cleanValues(values) {
  const clean = {};
  for (const field of TEXT_FIELDS) clean[field] = text(values[field]);
  const rank = parseRank(values.rank);
  clean.rank = Number.isNaN(rank) ? null : rank;
  return clean;
}

/** Returns a map of field -> message. Empty when the values are valid. */
export function validateValues(values, { requireCompany = true } = {}) {
  const errors = {};
  if (requireCompany && !isFilled(values.company)) errors.company = "Företag måste fyllas i.";
  if (Number.isNaN(parseRank(values.rank))) errors.rank = "Rangordning måste vara ett heltal från 1.";
  if (isFilled(values.email) && !isValidEmail(text(values.email))) errors.email = "Ange en giltig e-postadress.";
  return errors;
}

export function createApplication(values, now) {
  return { id: newId(), ...cleanValues(values), createdAt: now, updatedAt: now };
}

/** Coerces any stored record (including legacy ones using `contact`) to the current data model. */
export function normalizeApplication(raw, now) {
  const rank = raw.rank === null || raw.rank === "" ? NaN : Number(raw.rank);
  const created = text(raw.createdAt) || now;
  return {
    id: UUID_V4.test(text(raw.id)) ? text(raw.id) : newId(),
    rank: Number.isFinite(rank) ? rank : null,
    company: text(raw.company),
    city: text(raw.city),
    contactPerson: text(raw.contactPerson ?? raw.contact),
    email: text(raw.email),
    phone: text(raw.phone),
    motivation: text(raw.motivation),
    notes: text(raw.notes),
    createdAt: created,
    updatedAt: text(raw.updatedAt) || created,
  };
}

export const isIncomplete = (app) =>
  [...REQUIRED_FIELDS, ...OPTIONAL_CONTACT_FIELDS].some((f) => !isFilled(app[f]));
