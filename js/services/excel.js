import { cleanValues, createApplication, FIELDS, validateValues } from "../model/application.js";
import { sortApplications } from "../model/ranking.js";

// Loaded on demand so the app starts fast and no global `XLSX` is created.
const SHEETJS_URL = "https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs";
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export const MOTIVATION_HEADER = "Kort presentation av företaget samt motivering till topp 1-3 / 1-5";

export const COLUMNS = {
  rank: "Rangordning",
  company: "Företag",
  city: "Ort",
  contactPerson: "Kontaktperson",
  email: "E-post",
  phone: "Telefonnummer",
  motivation: MOTIVATION_HEADER,
  notes: "Anteckningar",
};

const OPTIONAL_COLUMNS = new Set(["notes"]);
const MAX_LISTED_ERRORS = 10;

export class ExcelError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = "ExcelError";
    this.details = details;
  }
}

let sheetjs = null;

function loadSheetJs() {
  sheetjs ??= import(/* @vite-ignore */ SHEETJS_URL).catch(() => {
    sheetjs = null;
    throw new ExcelError("Excel-biblioteket kunde inte laddas. Kontrollera din internetanslutning.");
  });
  return sheetjs;
}

/** Parses an .xlsx/.xls file into application records. Throws ExcelError with user-friendly messages. */
export async function importWorkbook(file, now = new Date().toISOString()) {
  if (file.size > MAX_FILE_BYTES) throw new ExcelError("Filen är för stor (max 5 MB).");
  const XLSX = await loadSheetJs();

  let rows;
  try {
    const book = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const sheet = book.Sheets[book.SheetNames[0]];
    if (!sheet) throw new ExcelError("Filen innehåller inget kalkylblad.");
    rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false, blankrows: true });
  } catch (error) {
    if (error instanceof ExcelError) throw error;
    throw new ExcelError("Felaktig filstruktur: filen kunde inte läsas som en Excel-fil.");
  }

  const headers = (rows[0] ?? []).map((h) => String(h).trim());
  const columnIndex = {};
  const missing = [];
  for (const [field, header] of Object.entries(COLUMNS)) {
    const index = headers.indexOf(header);
    if (index >= 0) columnIndex[field] = index;
    else if (!OPTIONAL_COLUMNS.has(field)) missing.push(header);
  }
  if (missing.length) throw new ExcelError(`Felaktig filstruktur. Kolumner saknas: ${missing.join(", ")}.`);

  const imported = [];
  const errors = [];
  rows.slice(1).forEach((cells, i) => {
    const values = {};
    for (const field of FIELDS) values[field] = String(cells[columnIndex[field]] ?? "").trim();

    // A row holding nothing but a rank counts as empty
    if (!FIELDS.some((f) => f !== "rank" && values[f])) return;

    const line = i + 2;
    for (const message of Object.values(validateValues(values, { requireCompany: false }))) {
      errors.push(`Rad ${line}: ${message}`);
    }
    imported.push(createApplication(values, now));
  });

  if (errors.length) {
    const details = errors.slice(0, MAX_LISTED_ERRORS);
    if (errors.length > MAX_LISTED_ERRORS) details.push(`…och ${errors.length - MAX_LISTED_ERRORS} fel till.`);
    throw new ExcelError("Importen avbröts, inga ansökningar lades till.", details);
  }
  if (!imported.length) throw new ExcelError("Filen innehåller inga rader att importera.");
  return imported;
}

/** Builds an .xlsx file with the same eight columns the importer expects. */
export async function exportWorkbook(applications) {
  const XLSX = await loadSheetJs();
  const rows = sortApplications(applications).map((app) => {
    const clean = cleanValues(app);
    return Object.fromEntries(Object.entries(COLUMNS).map(([field, header]) => [header, clean[field] ?? ""]));
  });
  const sheet = XLSX.utils.json_to_sheet(rows, { header: Object.values(COLUMNS) });
  sheet["!cols"] = [10, 25, 18, 22, 28, 18, 45, 45].map((wch) => ({ wch }));
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Ansökningar");
  const data = XLSX.write(book, { bookType: "xlsx", type: "array" });
  return new Blob([data], { type: XLSX_MIME });
}
