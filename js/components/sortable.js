/**
 * Makes the children of `list` reorderable with the mouse (HTML5 drag and drop) and the keyboard
 * (focus the drag handle, Space/Enter to pick up, arrows to move, Space/Enter to drop, Escape to cancel).
 * It only reports the final move; the owner decides how to apply it.
 */
export function createSortable(list, { onMove, announce = () => {}, itemSelector = ".item", handleSelector = ".drag-handle" }) {
  let dragId = null;
  let marked = null;
  let grab = null;

  const position = (item) => Array.prototype.indexOf.call(list.children, item) + 1;
  const where = (item) => `plats ${position(item)} av ${list.children.length}`;
  const nameOf = (item) => item.dataset.name ?? "Objekt";

  function mark(item, cls) {
    if (marked?.item === item && marked.cls === cls) return;
    unmark();
    item.classList.add(cls);
    marked = { item, cls };
  }

  function unmark() {
    marked?.item.classList.remove(marked.cls);
    marked = null;
  }

  function autoScroll(clientY) {
    const edge = 80;
    if (clientY < edge) window.scrollBy(0, -16);
    else if (clientY > window.innerHeight - edge) window.scrollBy(0, 16);
  }

  const isAfter = (e, item) => {
    const r = item.getBoundingClientRect();
    return e.clientY > r.top + r.height / 2;
  };

  // Mouse
  list.addEventListener("dragstart", (e) => {
    const item = e.target.closest?.(itemSelector);
    if (!item || e.target !== item) return;
    dragId = item.dataset.id;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", dragId);
    // Wait a frame so the drag image is captured before the dimming style applies
    requestAnimationFrame(() => item.classList.add("dragging"));
  });

  list.addEventListener("dragover", (e) => {
    if (!dragId) return;
    const item = e.target.closest?.(itemSelector);
    if (!item) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    autoScroll(e.clientY);
    if (item.dataset.id === dragId) unmark();
    else mark(item, isAfter(e, item) ? "drop-after" : "drop-before");
  });

  list.addEventListener("dragleave", (e) => {
    if (!list.contains(e.relatedTarget)) unmark();
  });

  list.addEventListener("drop", (e) => {
    const item = e.target.closest?.(itemSelector);
    if (!dragId || !item) return;
    e.preventDefault();
    if (item.dataset.id !== dragId) onMove(dragId, item.dataset.id, isAfter(e, item));
  });

  list.addEventListener("dragend", () => {
    list.querySelector(".dragging")?.classList.remove("dragging");
    unmark();
    dragId = null;
  });

  // Keyboard
  function startGrab(item, handle) {
    grab = { id: item.dataset.id, item, handle, nextSibling: item.nextElementSibling, moving: false };
    item.classList.add("grabbed");
    handle.setAttribute("aria-pressed", "true");
    announce(
      `${nameOf(item)} vald, ${where(item)}. Flytta med pil upp och pil ned, släpp med Retur eller mellanslag, avbryt med Escape.`
    );
  }

  function placeAt(reference) {
    grab.moving = true;
    list.insertBefore(grab.item, reference);
    grab.handle.focus();
    grab.moving = false;
    announce(where(grab.item).replace(/^plats/, "Plats"));
  }

  function endGrab({ commit, refocus = true }) {
    const { id, item, handle, nextSibling } = grab;
    grab = null;
    item.classList.remove("grabbed");
    handle.setAttribute("aria-pressed", "false");
    if (commit) {
      const prev = item.previousElementSibling;
      const next = item.nextElementSibling;
      if (prev) onMove(id, prev.dataset.id, true);
      else if (next) onMove(id, next.dataset.id, false);
    } else {
      list.insertBefore(item, nextSibling);
      if (refocus) handle.focus();
      announce("Flytt avbruten.");
    }
  }

  list.addEventListener("keydown", (e) => {
    const handle = e.target.closest?.(handleSelector);
    if (!handle) return;
    const item = handle.closest(itemSelector);
    const activate = e.key === " " || e.key === "Enter";

    if (!grab) {
      if (activate) {
        e.preventDefault();
        startGrab(item, handle);
      }
      return;
    }
    if (grab.item !== item) return;

    if (activate) {
      e.preventDefault();
      endGrab({ commit: true });
    } else if (e.key === "Escape") {
      e.preventDefault();
      endGrab({ commit: false });
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const up = e.key === "ArrowUp";
      const neighbour = up ? item.previousElementSibling : item.nextElementSibling;
      if (!neighbour) announce(up ? "Redan först i listan." : "Redan sist i listan.");
      else placeAt(up ? neighbour : neighbour.nextElementSibling);
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      placeAt(e.key === "Home" ? list.firstElementChild : null);
    }
  });

  // Losing focus while holding an item cancels the move
  list.addEventListener("focusout", (e) => {
    if (grab && !grab.moving && e.target === grab.handle) endGrab({ commit: false, refocus: false });
  });
}
