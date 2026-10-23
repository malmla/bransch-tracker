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

function render() {
  listEl.replaceChildren();
  $("count").textContent = applications.length;
  $("empty").hidden = applications.length > 0;

  for (const app of sorted()) {
    const li = el("li", "item");
    li.append(el("div", "rank", app.rank));

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
    meta.append(mail, tel);
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

render();
