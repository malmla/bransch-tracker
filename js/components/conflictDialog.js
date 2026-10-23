import { h } from "../utils/dom.js";

const FIELD_LABELS = {
  rank: "Rangordning",
  city: "Ort",
  contactPerson: "Kontaktperson",
  email: "E-post",
  phone: "Telefon",
  motivation: "Presentation",
  notes: "Anteckningar",
};

function describe(app) {
  const parts = Object.entries(FIELD_LABELS)
    .filter(([field]) => app[field] !== "" && app[field] !== null && app[field] !== undefined)
    .map(([field, label]) => `${label}: ${app[field]}`);
  return parts.length ? parts.join(" · ") : "Inga andra uppgifter";
}

/**
 * Modal that lets the user pick, per company that already exists, which version to keep.
 * `ask()` resolves to an array of "keep" | "excel" (one per conflict) or null when cancelled.
 */
export function createConflictDialog(dialog) {
  const list = dialog.querySelector("[data-conflict-list]");
  let resolve = null;

  const finish = (value) => {
    const pending = resolve;
    resolve = null;
    pending?.(value);
  };
  const setAll = (value) => list.querySelectorAll(`input[value="${value}"]`).forEach((r) => (r.checked = true));

  dialog.querySelector("[data-conflict-all-keep]").addEventListener("click", () => setAll("keep"));
  dialog.querySelector("[data-conflict-all-excel]").addEventListener("click", () => setAll("excel"));
  dialog.querySelector("[data-conflict-cancel]").addEventListener("click", () => dialog.close());
  dialog.querySelector("[data-conflict-confirm]").addEventListener("click", () => {
    const names = [...list.querySelectorAll("fieldset")].map((_, i) => `conflict-${i}`);
    finish(names.map((name) => list.querySelector(`input[name="${name}"]:checked`).value));
    dialog.close();
  });
  // Escape or backdrop close counts as cancel
  dialog.addEventListener("close", () => finish(null));

  return {
    ask(conflicts) {
      list.replaceChildren(
        ...conflicts.map(({ existing, row }, i) =>
          h(
            "fieldset",
            { class: "conflict" },
            h("legend", {}, existing.company),
            ...[
              ["keep", "Behåll befintlig", existing],
              ["excel", "Använd Excel-versionen", row],
            ].map(([value, label, app]) =>
              h(
                "label",
                { class: "choice" },
                h("input", { type: "radio", name: `conflict-${i}`, value, checked: value === "keep" }),
                h("span", {}, h("strong", {}, label), h("small", {}, describe(app)))
              )
            )
          )
        )
      );
      return new Promise((res) => {
        resolve = res;
        dialog.showModal();
        list.querySelector("input")?.focus();
      });
    },
  };
}
