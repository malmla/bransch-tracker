/**
 * Tiny element factory. Children are appended as text nodes or elements,
 * never parsed as HTML, so user data can't inject markup.
 *
 * Props: class, text, dataset, on<Event> handlers; everything else is set as an attribute.
 */
export function h(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key === "dataset") Object.assign(node.dataset, value);
    else if (key.startsWith("on")) node.addEventListener(key.slice(2).toLowerCase(), value);
    else node.setAttribute(key, value === true ? "" : String(value));
  }
  node.append(...children.filter((c) => c !== null && c !== undefined && c !== false));
  return node;
}

/** Returns the element with `id` or throws a descriptive error. */
export function must(id, root = document) {
  const node = root.getElementById(id);
  if (!node) throw new Error(`Elementet #${id} saknas i sidan.`);
  return node;
}

export function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
