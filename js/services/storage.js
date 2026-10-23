import { normalizeApplication } from "../model/application.js";
import { newId } from "../utils/id.js";

function defaultBackend() {
  try {
    return window.localStorage;
  } catch {
    return null; // blocked by browser privacy settings
  }
}

/**
 * LocalStorage persistence. Never throws: failures are reported in the returned result
 * so the app keeps working in memory.
 */
export function createStorage(key, backend = defaultBackend()) {
  function load() {
    if (!backend) return { items: [], problem: "unavailable" };

    let raw;
    try {
      raw = backend.getItem(key);
    } catch {
      return { items: [], problem: "unavailable" };
    }
    if (raw === null) return { items: [] };

    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      data = null;
    }
    if (!Array.isArray(data)) {
      let backupSaved = false;
      try {
        backend.setItem(`${key}.backup`, raw);
        backupSaved = true;
      } catch {
        /* best effort */
      }
      return { items: [], problem: backupSaved ? "corrupt" : "corrupt-backup-failed" };
    }

    const now = new Date().toISOString();
    const seen = new Set();
    const items = data
      .filter((d) => d && typeof d === "object" && !Array.isArray(d))
      .map((d) => {
        const app = normalizeApplication(d, now);
        if (seen.has(app.id)) app.id = newId();
        seen.add(app.id);
        return app;
      });
    const migrated = JSON.stringify(data) !== JSON.stringify(items);
    if (migrated && !save(items).ok) return { items, problem: "migration-save-failed" };
    return { items };
  }

  function save(items) {
    if (!backend) return { ok: false, error: new Error("LocalStorage är inte tillgängligt.") };
    try {
      backend.setItem(key, JSON.stringify(items));
      return { ok: true };
    } catch (error) {
      return { ok: false, error };
    }
  }

  return { load, save };
}
