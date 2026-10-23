const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isFilled = (value) => String(value ?? "").trim() !== "";

export const isValidEmail = (value) => EMAIL_PATTERN.test(value);

/** Case- and whitespace-insensitive key so "ikea" and " IKEA " match. */
export function normalizeName(name) {
  return String(name ?? "").normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("sv");
}
