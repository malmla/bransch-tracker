import { h } from "../utils/dom.js";

const TIER_LABELS = { gold: "Guld", silver: "Silver", bronze: "Brons", premium: "Premium" };

const missing = (label) => h("span", { class: "missing" }, `${label} saknas`);

const actionButton = (text, action, label, extraClass = "") =>
  h("button", { type: "button", class: `btn small ${extraClass}`.trim(), "data-action": action, "aria-label": label }, text);

/** Everything that affects how a card looks; used to skip rebuilding unchanged cards. */
export function cardSignature({ app, tier, priority }) {
  return JSON.stringify([
    app.rank, app.company, app.city, app.contactPerson, app.email, app.phone, app.motivation, app.notes, tier, priority,
  ]);
}

export function createCard({ app, tier, priority }) {
  const name = app.company || "företag utan namn";

  const rank = h(
    "div",
    { class: "rank" },
    h("span", { class: "rank-label" }, "Rang"),
    h("span", { class: "rank-number" }, app.rank ?? "–"),
    tier && h("span", { class: "sr-only" }, ` (${TIER_LABELS[tier]})`)
  );

  const heading = h(
    "h3",
    {},
    app.company || missing("Företag"),
    " ",
    h("span", { class: "city" }, app.city ? `· ${app.city}` : missing("Ort"))
  );

  const email = app.email
    ? h("a", { href: `mailto:${app.email}`, class: priority ? "email-priority" : null }, app.email)
    : missing("E-post");
  const phone = app.phone
    ? h("a", { href: `tel:${app.phone.replace(/[^\d+]/g, "")}` }, app.phone)
    : missing("Telefonnummer");
  const meta = h(
    "div",
    { class: "meta" },
    h("span", {}, app.contactPerson ? `👤 ${app.contactPerson}` : missing("Kontaktperson")),
    email,
    priority && h("span", { class: "priority-badge" }, "Prioriterad kontakt"),
    phone
  );

  const notes = [["Motivering", app.motivation], ["Anteckningar", app.notes]]
    .filter(([, value]) => value)
    .map(([label, value]) => h("p", { class: "text" }, h("strong", {}, label), value));

  const actions = h(
    "div",
    { class: "actions" },
    actionButton("Redigera", "edit", `Redigera ${name}`),
    actionButton("Ta bort", "delete", `Ta bort ${name}`, "danger"),
    actionButton("▲", "move-up", `Flytta upp ${name}`, "icon"),
    actionButton("▼", "move-down", `Flytta ned ${name}`, "icon")
  );

  return h(
    "li",
    {
      class: tier ? `item tier-${tier}` : "item",
      draggable: "true",
      dataset: { id: app.id, name },
    },
    h(
      "button",
      {
        type: "button",
        class: "drag-handle",
        "data-action": "grab",
        "aria-label": `Flytta ${name}`,
        "aria-describedby": "dnd-help",
        "aria-pressed": "false",
      },
      "⠿"
    ),
    rank,
    h("div", { class: "item-body" }, heading, meta, ...notes, actions)
  );
}
