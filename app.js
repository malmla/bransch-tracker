const STORAGE_KEY = "lia-applications";
const FIELDS = ["rank", "company", "city", "contact", "email", "phone", "motivation", "notes"];
const REQUIRED = ["rank", "company", "city", "contact", "email", "phone"];

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

function sorted() {
  return [...applications].sort((a, b) => a.rank - b.rank || a.company.localeCompare(b.company, "sv"));
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

function render() {
  listEl.replaceChildren();
  $("count").textContent = applications.length;
  $("empty").hidden = applications.length > 0;

  const priorityCount = applications.length >= 50 ? 30 : 15;
  for (const [index, app] of sorted().entries()) {
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
    rank.append(el("span", "rank-label", "Rang"), el("span", "rank-number", app.rank));
    li.append(el("div", "handle", "⠿"), rank);

    const body = el("div");
    const h3 = el("h3", "", app.company + " ");
    h3.append(el("span", "city", "· " + app.city));
    body.append(h3);

    const meta = el("div", "meta");
    meta.append(el("span", "", "👤 " + app.contact));
    const mail = el("a", "", app.email);
    mail.href = "mailto:" + app.email;
    const tel = el("a", "", app.phone);
    tel.href = "tel:" + app.phone.replace(/[^\d+]/g, "");
    if (index < priorityCount) {
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
}

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
  for (const f of REQUIRED) {
    if (!values[f] || !$(f).checkValidity()) {
      $(f).classList.add("invalid");
      valid = false;
    }
  }
  const error = $("error");
  if (!valid) {
    error.textContent = "Fyll i alla obligatoriska fält med giltiga värden.";
    error.hidden = false;
    return;
  }
  error.hidden = true;

  values.rank = Number(values.rank);
  const id = $("id").value;
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
    "Kort presentation": a.motivation || "",
    Anteckningar: a.notes || "",
  }));
  const sheet = XLSX.utils.json_to_sheet(rows);
  sheet["!cols"] = [10, 25, 18, 22, 28, 18, 45, 45].map((wch) => ({ wch }));
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Ansökningar");
  XLSX.writeFile(book, "lia-ansokningar.xlsx");
});

render();
