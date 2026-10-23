const THEME_KEY = "lia-theme";

function readStoredTheme() {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return { theme: value === "light" || value === "dark" ? value : null };
  } catch (error) {
    return { theme: null, error };
  }
}

/** Light/dark toggle. Follows the system setting until the user picks one explicitly. */
export function createThemeToggle(button, { onError = () => {} } = {}) {
  const root = document.documentElement;
  const system = window.matchMedia("(prefers-color-scheme: dark)");

  const isDark = () => (root.dataset.theme ? root.dataset.theme === "dark" : system.matches);
  const sync = () => button.setAttribute("aria-pressed", String(isDark()));

  button.addEventListener("click", () => {
    const next = isDark() ? "light" : "dark";
    root.dataset.theme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch (error) {
      onError(error);
    }
    sync();
  });
  system.addEventListener("change", sync);

  const stored = readStoredTheme();
  if (stored.theme) root.dataset.theme = stored.theme;
  else if (stored.error) onError(stored.error);
  sync();
}
