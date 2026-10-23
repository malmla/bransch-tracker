import { h } from "../utils/dom.js";

/** Visible message area. Errors are announced assertively, everything else politely. */
export function createStatus(root) {
  return {
    show(lines, type = "info") {
      const role = type === "error" ? "alert" : "status";
      root.className = `status status-${type}`;
      root.replaceChildren(...lines.map((line) => h("div", { role }, line)));
      root.hidden = lines.length === 0;
    },
    clear() {
      root.replaceChildren();
      root.hidden = true;
    },
  };
}

/** Screen reader announcements through a visually hidden live region. */
export function createAnnouncer(region) {
  let timer = null;
  return (message) => {
    region.textContent = "";
    clearTimeout(timer);
    timer = setTimeout(() => (region.textContent = message), 50);
  };
}
