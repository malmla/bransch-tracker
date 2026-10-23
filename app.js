const STORAGE_KEY = "lia-applications";
const FIELDS = ["rank", "company", "city", "contact", "email", "phone", "motivation", "notes"];
const REQUIRED = ["company"];
const CONTACT_FIELDS = ["rank", "city", "contact", "email", "phone"];

const $ = (id) => document.getElementById(id);
const form = $("application-form");
const listEl = $("list");

let applications = load();

function load() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(applications));
}

function rankValue(app) {
  return Number.isFinite(app.rank) && app.rank !== null ? app.rank : Infinity;
}

function sorted() {
  return [...applications].sort((a, b) => {
    const ra = rankValue(a);
    const rb = rankValue(b);
    if (ra !== rb) return ra < rb ? -1 : 1;
    return a.company.localeCompare(b.company, "sv");
  });
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function tierFor(rank) {
  if (applications.length >= 50) return rank >= 1 && rank <= 5 ? "tier-premium" : "";
  return { 1: "tier-gold", 2: "tier-silver", 3: "tier-bronze" }[rank] || "";
}

function missingTag(label) {
  return el("span", "missing", `${label} saknas`);
}

function renderDashboard() {
  const has = (f) => applications.filter((a) => String(a[f] ?? "").trim()).length;
  $("stat-total").textContent = applications.length;
  $("stat-contact").textContent = has("contact");
  $("stat-email").textContent = has("email");
  $("stat-motivation").textContent = has("motivation");
}

const filters = { contact: "", email: "", phone: "" };

function matchesFilters(app) {
  return Object.entries(filters).every(([field, mode]) => {
    if (!mode) return true;
    const filled = Boolean(String(app[field] ?? "").trim());
    return mode === "has" ? filled : !filled;
  });
}

function render() {
  renderDashboard();
  listEl.replaceChildren();
  $("count").textContent = applications.length;
  const filtering = Object.values(filters).some(Boolean);
  let shown = 0;
  const priorityCount = applications.length >= 50 ? 30 : 15;
  for (const [index, app] of sorted().entries()) {
    if (!matchesFilters(app)) continue;
    shown++;
    const li = el("li", "item");
    const tier = tierFor(app.rank);
    if (tier) li.classList.add(tier);
    li.draggable = true;
    li.dataset.id = app.id;
    li.addEventListener("dragstart", onDragStart);
    li.addEventListener("dragend", onDragEnd);
    li.addEventListener("dragover", onDragOver);
    li.addEventListener("drop", onDrop);
    const rank = el("div", "rank");
    rank.append(el("span", "rank-label", "Rang"), el("span", "rank-number", app.rank ?? "–"));
    li.append(el("div", "handle", "⠿"), rank);

    const body = el("div");
    const h3 = el("h3", "", "");
    h3.append(app.company ? document.createTextNode(app.company + " ") : missingTag("Företag"));
    h3.append(el("span", "city", ""));
    h3.lastChild.append(app.city ? document.createTextNode("· " + app.city) : missingTag("Ort"));
    body.append(h3);

    const meta = el("div", "meta");
    const contact = el("span", "");
    contact.append(app.contact ? document.createTextNode("👤 " + app.contact) : missingTag("Kontaktperson"));
    meta.append(contact);
    const mail = app.email ? el("a", "", app.email) : missingTag("E-post");
    if (app.email) mail.href = "mailto:" + app.email;
    const tel = app.phone ? el("a", "", app.phone) : missingTag("Telefonnummer");
    if (app.phone) tel.href = "tel:" + app.phone.replace(/[^\d+]/g, "");
    if (index < priorityCount && app.email) {
      mail.classList.add("email-priority");
      const badge = el("span", "priority-badge", "Prioriterad kontakt");
      meta.append(mail, badge, tel);
    } else {
      meta.append(mail, tel);
    }
    body.append(meta);

    for (const [label, value] of [["Motivering", app.motivation], ["Anteckningar", app.notes]]) {
      if (!value) continue;
      const p = el("p", "text");
      p.append(el("strong", "", label), document.createTextNode(value));
      body.append(p);
    }

    const actions = el("div", "actions");
    const edit = el("button", "btn small", "Redigera");
    edit.type = "button";
    edit.addEventListener("click", () => startEdit(app.id));
    const del = el("button", "btn small danger", "Ta bort");
    del.type = "button";
    del.addEventListener("click", () => remove(app.id));
    actions.append(edit, del);
    body.append(actions);

    li.append(body);
    listEl.append(li);
  }

  const empty = $("empty");
  empty.hidden = shown > 0;
  empty.textContent = applications.length && !shown ? "Inga ansökningar matchar filtret." : "Inga ansökningar ännu.";
  $("filter-reset").hidden = !filtering;
  const info = $("filter-info");
  info.hidden = !filtering;
  info.textContent = `Visar ${shown} av ${applications.length}`;
}

document.querySelectorAll("[data-filter]").forEach((select) => {
  select.addEventListener("change", () => {
    filters[select.dataset.filter] = select.value;
    render();
  });
});

$("filter-reset").addEventListener("click", () => {
  document.querySelectorAll("[data-filter]").forEach((s) => {
    s.value = "";
    filters[s.dataset.filter] = "";
  });
  render();
});

let draggedId = null;

function clearDropMarks() {
  listEl.querySelectorAll(".drop-before, .drop-after").forEach((n) => n.classList.remove("drop-before", "drop-after"));
}

function isAfter(e, li) {
  const r = li.getBoundingClientRect();
  return e.clientY > r.top + r.height / 2;
}

function onDragStart(e) {
  draggedId = this.dataset.id;
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", draggedId);
  // Delay so the drag image is captured before the dimming style applies
  requestAnimationFrame(() => this.classList.add("dragging"));
}

function onDragEnd() {
  draggedId = null;
  this.classList.remove("dragging");
  clearDropMarks();
}

function onDragOver(e) {
  if (!draggedId) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
  clearDropMarks();
  if (this.dataset.id !== draggedId) {
    this.classList.add(isAfter(e, this) ? "drop-after" : "drop-before");
  }
}

function onDrop(e) {
  e.preventDefault();
  if (!draggedId || this.dataset.id === draggedId) return;
  const after = isAfter(e, this);
  const order = sorted().map((a) => a.id).filter((id) => id !== draggedId);
  const idx = order.indexOf(this.dataset.id) + (after ? 1 : 0);
  order.splice(idx, 0, draggedId);
  order.forEach((id, i) => {
    applications.find((a) => a.id === id).rank = i + 1;
  });
  save();
  draggedId = null;
  render();
}

function resetForm() {
  form.reset();
  $("id").value = "";
  $("form-title").textContent = "Ny ansökan";
  $("submit-btn").textContent = "Spara ansökan";
  $("cancel-btn").hidden = true;
  $("error").hidden = true;
  FIELDS.forEach((f) => $(f).classList.remove("invalid"));
}

function startEdit(id) {
  const app = applications.find((a) => a.id === id);
  if (!app) return;
  $("id").value = app.id;
  FIELDS.forEach((f) => ($(f).value = app[f] ?? ""));
  $("form-title").textContent = "Redigera ansökan";
  $("submit-btn").textContent = "Uppdatera ansökan";
  $("cancel-btn").hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
  $("company").focus({ preventScroll: true });
}

function remove(id) {
  const app = applications.find((a) => a.id === id);
  if (!app || !confirm(`Ta bort ansökan till ${app.company}?`)) return;
  applications = applications.filter((a) => a.id !== id);
  save();
  if ($("id").value === id) resetForm();
  render();
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const values = {};
  FIELDS.forEach((f) => (values[f] = $(f).value.trim()));

  let valid = true;
  for (const f of FIELDS) $(f).classList.remove("invalid");
  for (const f of FIELDS) {
    const missing = REQUIRED.includes(f) && !values[f];
    const badValue = values[f] && !$(f).checkValidity();
    if (missing || badValue) {
      $(f).classList.add("invalid");
      valid = false;
    }
  }
  const error = $("error");
  if (!valid) {
    error.textContent = "Företag är obligatoriskt, och ifyllda fält måste ha giltiga värden.";
    error.hidden = false;
    return;
  }
  error.hidden = true;

  values.rank = values.rank ? Number(values.rank) : null;
  const id = $("id").value;
  if (values.rank === null) {
    const others = applications.filter((a) => a.id !== id).map((a) => a.rank).filter(Number.isFinite);
    values.rank = others.length ? Math.max(...others) + 1 : 1;
  }
  if (id) {
    applications = applications.map((a) => (a.id === id ? { ...a, ...values } : a));
  } else {
    applications.push({ id: crypto.randomUUID?.() ?? String(Date.now()), ...values });
  }
  save();
  resetForm();
  render();
});

$("cancel-btn").addEventListener("click", resetForm);

const MOTIVATION_HEADER = "Kort presentation av företaget samt motivering till topp 1-3 / 1-5";

const IMPORT_COLUMNS = {
  rank: "Rangordning",
  company: "Företag",
  city: "Ort",
  contact: "Kontaktperson",
  email: "E-post",
  phone: "Telefonnummer",
  motivation: MOTIVATION_HEADER,
  notes: "Anteckningar",
};

function showImportMessage(lines, ok = false) {
  const msg = $("import-msg");
  msg.replaceChildren(...lines.map((l) => el("div", "", l)));
  msg.style.color = ok ? "#166534" : "";
  msg.hidden = !lines.length;
}

function parseWorkbook(buffer) {
  const book = XLSX.read(buffer, { type: "array" });
  const sheet = book.Sheets[book.SheetNames[0]];
  if (!sheet) throw new Error("Filen innehåller inget kalkylblad.");

  const headers = (XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" })[0] ?? []).map((h) => String(h).trim());
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
  const missing = Object.entries(IMPORT_COLUMNS)
    .filter(([field, header]) => field !== "notes" && !headers.includes(header))
    .map(([, header]) => header);
  if (missing.length) {
    throw new Error(`Felaktig filstruktur. Kolumner saknas: ${missing.join(", ")}.`);
  }
  if (!rows.length) throw new Error("Filen innehåller inga rader att importera.");

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const errors = [];
  const imported = [];
  rows.forEach((row, i) => {
    const app = { id: crypto.randomUUID?.() ?? `${Date.now()}-${i}` };
    for (const [field, header] of Object.entries(IMPORT_COLUMNS)) {
      app[field] = String(row[header] ?? "").trim();
    }
    if (!FIELDS.some((f) => f !== "rank" && app[f])) return;
    const line = i + 2;
    if (app.rank && !(Number(app.rank) >= 1)) errors.push(`Rad ${line}: Rangordning måste vara ett tal från 1.`);
    if (app.email && !emailRe.test(app.email)) errors.push(`Rad ${line}: ogiltig e-postadress.`);
    app.rank = app.rank ? Number(app.rank) : null;
    imported.push(app);
  });
  if (!imported.length && !errors.length) throw new Error("Filen innehåller inga rader att importera.");
  if (errors.length) {
    const shown = errors.slice(0, 10);
    if (errors.length > 10) shown.push(`…och ${errors.length - 10} fel till.`);
    throw Object.assign(new Error("Importen avbröts, inga ansökningar lades till."), { details: shown });
  }
  return imported;
}

$("import-btn").addEventListener("click", () => $("import-file").click());

$("import-file").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  if (typeof XLSX === "undefined") {
    showImportMessage(["Excel-biblioteket kunde inte laddas. Kontrollera din internetanslutning."]);
    return;
  }
  try {
    const imported = parseWorkbook(await file.arrayBuffer());
    applications.push(...imported);
    // Renumber so imported ranks never collide with existing ones
    sorted().forEach((a, i) => (a.rank = i + 1));
    save();
    render();
    const incomplete = imported.filter((a) => REQUIRED.concat(CONTACT_FIELDS).some((f) => a[f] === "" || a[f] === null)).length;
    showImportMessage([
      `${imported.length} ansökningar importerades.`,
      ...(incomplete ? [`${incomplete} av dem har tomma fält, markerade med "saknas" i listan.`] : []),
    ], true);
  } catch (err) {
    const base = err.details ? err.message : err.message?.startsWith("Felaktig") || err.message?.startsWith("Filen") ? err.message : "Felaktig filstruktur: filen kunde inte läsas som en Excel-fil.";
    showImportMessage([base, ...(err.details ?? [])]);
  }
});

$("export-btn").addEventListener("click", () => {
  if (typeof XLSX === "undefined") {
    alert("Excel-biblioteket kunde inte laddas. Kontrollera din internetanslutning.");
    return;
  }
  if (!applications.length) {
    alert("Det finns inga ansökningar att exportera.");
    return;
  }
  const rows = sorted().map((a) => ({
    Rangordning: a.rank,
    Företag: a.company,
    Ort: a.city,
    Kontaktperson: a.contact,
    "E-post": a.email,
    Telefonnummer: a.phone,
    [MOTIVATION_HEADER]: a.motivation || "",
    Anteckningar: a.notes || "",
  }));
  const sheet = XLSX.utils.json_to_sheet(rows);
  sheet["!cols"] = [10, 25, 18, 22, 28, 18, 45, 45].map((wch) => ({ wch }));
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Ansökningar");
  XLSX.writeFile(book, "lia-ansokningar.xlsx");
});

render();
