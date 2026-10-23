import {
  cleanValues,
  createApplication,
  isIncomplete,
  validateValues,
} from "../model/application.js";
import { createFilters } from "../model/filters.js";
import { assignRanks, moveInOrder, nextRank, sortApplications } from "../model/ranking.js";

/**
 * Single source of truth. Applications are treated as immutable: every change produces
 * new objects, persists, and notifies subscribers.
 */
export function createStore({ storage, now = () => new Date().toISOString(), onSaveError = () => {} }) {
  let state = { applications: [], filters: createFilters() };
  const listeners = new Set();

  function commit(patch, { persist = false } = {}) {
    state = { ...state, ...patch };
    let saved = { ok: true };
    if (persist) {
      saved = storage.save(state.applications);
      if (!saved.ok) onSaveError(saved.error);
    }
    listeners.forEach((listener) => listener(state));
    return saved;
  }

  return {
    getState: () => state,

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    /** (Re)loads applications from storage. Returns the storage problem, if any. */
    load() {
      const { items, problem } = storage.load();
      commit({ applications: items });
      return problem;
    },

    /** Validates and creates (no id) or updates (id) an application. */
    saveApplication(values, id = null) {
      const errors = validateValues(values, { requireCompany: true });
      if (Object.keys(errors).length) return { ok: false, errors };

      const t = now();
      const clean = cleanValues(values);
      const apps = state.applications;
      if (id && !apps.some((a) => a.id === id)) {
        return { ok: false, errors: { _form: "Företaget finns inte längre och kan inte uppdateras." } };
      }
      clean.rank ??= nextRank(apps, id);

      const next = id
        ? apps.map((a) => (a.id === id ? { ...a, ...clean, updatedAt: t } : a))
        : [...apps, createApplication(clean, t)];
      const saved = commit({ applications: next }, { persist: true });
      return { ok: true, persisted: saved.ok };
    },

    remove(id) {
      commit({ applications: state.applications.filter((a) => a.id !== id) }, { persist: true });
    },

    /** Moves an application next to another one and renumbers. Returns the new rank, or null if unchanged. */
    move(id, targetId, after) {
      const ids = sortApplications(state.applications).map((a) => a.id);
      const order = moveInOrder(ids, id, targetId, after);
      if (!order) return null;
      const next = assignRanks(state.applications, order, now());
      commit({ applications: next }, { persist: true });
      return next.find((a) => a.id === id).rank;
    },

    /**
     * Adds `fresh` applications and, per conflict, either keeps the existing one ("keep")
     * or overwrites it with the Excel row ("excel").
     */
    applyImport(fresh, conflicts, choices) {
      const t = now();
      const updates = new Map();
      conflicts.forEach(({ existing, row }, i) => {
        if (choices[i] !== "excel") return;
        const fields = cleanValues(row);
        updates.set(existing.id, { ...existing, ...fields, rank: row.rank ?? existing.rank, updatedAt: t });
      });

      const merged = [...state.applications.map((a) => updates.get(a.id) ?? a), ...fresh];
      const keepTimestamp = new Set([...updates.keys(), ...fresh.map((a) => a.id)]);
      const ranked = assignRanks(merged, sortApplications(merged).map((a) => a.id), t, keepTimestamp);
      const saved = commit({ applications: ranked }, { persist: true });

      const touched = [...fresh, ...updates.values()];
      return {
        added: fresh.length,
        updated: updates.size,
        kept: conflicts.length - updates.size,
        incomplete: touched.filter(isIncomplete).length,
        persisted: saved.ok,
      };
    },

    setFilter(field, mode) {
      commit({ filters: { ...state.filters, [field]: mode } });
    },

    resetFilters() {
      commit({ filters: createFilters() });
    },
  };
}
