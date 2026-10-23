import { createCard, cardSignature } from "./applicationCard.js";
import { createSortable } from "./sortable.js";

/**
 * Renders the list with keyed reconciliation: cards whose data did not change are reused,
 * so even a few hundred applications update quickly. All interaction uses event delegation.
 */
export function createApplicationList(root, { emptyEl, onEdit, onDelete, onMove, announce }) {
  const cards = new Map(); // id -> { el, signature }

  createSortable(root, { onMove, announce });

  root.addEventListener("click", (e) => {
    const button = e.target.closest("button[data-action]");
    const item = button?.closest(".item");
    if (!item) return;
    const id = item.dataset.id;

    switch (button.dataset.action) {
      case "edit":
        onEdit(id);
        break;
      case "delete":
        onDelete(id);
        break;
      case "move-up": {
        const prev = item.previousElementSibling;
        if (prev) onMove(id, prev.dataset.id, false);
        else announce("Redan först i listan.");
        break;
      }
      case "move-down": {
        const next = item.nextElementSibling;
        if (next) onMove(id, next.dataset.id, true);
        else announce("Redan sist i listan.");
        break;
      }
    }
  });

  /** Keeps keyboard focus on the same control when its card gets rebuilt or moved. */
  function restoreFocus(active, itemId, action) {
    if (!itemId || document.activeElement === active) return;
    const card = cards.get(itemId)?.el;
    card?.querySelector(`[data-action="${action}"]`)?.focus({ preventScroll: true });
  }

  function update(visible, { total, filtering }) {
    const active = root.contains(document.activeElement) ? document.activeElement : null;
    const activeItemId = active?.closest(".item")?.dataset.id;
    const activeAction = active?.dataset.action;

    const wanted = new Set(visible.map((v) => v.app.id));
    for (const [id, entry] of cards) {
      if (!wanted.has(id)) {
        entry.el.remove();
        cards.delete(id);
      }
    }

    const ordered = visible.map((item) => {
      const signature = cardSignature(item);
      const entry = cards.get(item.app.id);
      if (entry?.signature === signature) return entry.el;
      const el = createCard(item);
      entry?.el.replaceWith(el);
      cards.set(item.app.id, { el, signature });
      return el;
    });

    // Only touch the DOM where the order actually differs
    let cursor = root.firstElementChild;
    for (const el of ordered) {
      if (el === cursor) cursor = cursor.nextElementSibling;
      else root.insertBefore(el, cursor);
    }

    restoreFocus(active, activeItemId, activeAction);

    emptyEl.hidden = visible.length > 0;
    emptyEl.textContent = total && filtering ? "Inga ansökningar matchar filtret." : "Inga ansökningar ännu.";
  }

  return { update };
}
