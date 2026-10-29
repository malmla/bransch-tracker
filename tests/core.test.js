import assert from "node:assert/strict";
import test from "node:test";
import { isIncomplete, validateValues } from "../js/model/application.js";
import { createFilters, matchesFilters } from "../js/model/filters.js";
import { planImport } from "../js/model/importPlan.js";
import { sortApplications, tierFor } from "../js/model/ranking.js";
import { createStorage } from "../js/services/storage.js";
import { createStore } from "../js/state/store.js";

function memoryBackend(seed = {}) {
  const data = new Map(Object.entries(seed));
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    data,
  };
}

function createTestStore() {
  let tick = 0;
  const storage = createStorage("test", memoryBackend());
  return createStore({
    storage,
    now: () => new Date(Date.UTC(2026, 0, 1, 0, 0, tick++)).toISOString(),
  });
}

test("legacy LocalStorage records are normalized and retain old contact data", () => {
  const backend = memoryBackend({
    applications: JSON.stringify([{ id: "legacy-id", rank: "", company: "IKEA", contact: "Anna" }]),
  });
  const { items, problem } = createStorage("applications", backend).load();
  assert.equal(problem, undefined);
  assert.equal(items[0].contactPerson, "Anna");
  assert.match(items[0].id, /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i);
  assert.equal(items[0].rank, null);
  assert.ok(items[0].createdAt);
  assert.equal(JSON.parse(backend.getItem("applications"))[0].contactPerson, "Anna");
});

test("corrupt storage is backed up and storage failures are reported", () => {
  const backend = memoryBackend({ apps: "{broken" });
  const corrupt = createStorage("apps", backend).load();
  assert.equal(corrupt.problem, "corrupt");
  assert.equal(backend.getItem("apps.backup"), "{broken");

  const failing = { getItem: () => null, setItem: () => { throw new Error("quota"); } };
  assert.equal(createStorage("apps", failing).save([]).ok, false);
  assert.equal(createStorage("apps", null).load().problem, "unavailable");
});

test("only company is required; other fields remain optional but validated when provided", () => {
  assert.equal(Object.keys(validateValues({ company: "IKEA" })).length, 0);
  assert.ok(validateValues({ company: "" }).company);
  assert.ok(validateValues({ company: "IKEA", email: "not-an-email" }).email);
  assert.ok(validateValues({ company: "IKEA", rank: "2.5" }).rank);
  assert.equal(isIncomplete({ company: "IKEA", rank: 1, city: "", contactPerson: "", email: "", phone: "" }), true);
});

test("store creates, edits, reorders and removes applications with timestamps", () => {
  const store = createTestStore();
  store.load();
  for (const company of ["IKEA", "Volvo", "Saab"]) {
    assert.equal(store.saveApplication({ company }).ok, true);
  }
  let apps = sortApplications(store.getState().applications);
  assert.deepEqual(apps.map(({ company, rank }) => [company, rank]), [["IKEA", 1], ["Volvo", 2], ["Saab", 3]]);
  const editedId = apps[0].id;
  const created = apps[0].createdAt;

  assert.equal(store.saveApplication({ company: "IKEA AB", rank: "" }, editedId).ok, true);
  apps = sortApplications(store.getState().applications);
  assert.equal(apps.find((app) => app.id === editedId).createdAt, created);
  assert.equal(store.getState().applications.find((app) => app.id === editedId).rank, 4);

  const ids = sortApplications(store.getState().applications).map((app) => app.id);
  assert.equal(store.move(ids[2], ids[0], false), 1);
  assert.deepEqual(sortApplications(store.getState().applications).map((app) => app.rank), [1, 2, 3]);
  store.remove(ids[0]);
  assert.equal(store.getState().applications.length, 2);
});

test("setting a rank moves other applications without creating duplicate ranks", () => {
  const store = createTestStore();
  store.load();
  for (const company of ["IKEA", "Volvo", "Saab"]) store.saveApplication({ company });

  assert.equal(store.saveApplication({ company: "Nytt företag", rank: "2" }).ok, true);
  let apps = sortApplications(store.getState().applications);
  assert.deepEqual(apps.map(({ company, rank }) => [company, rank]), [
    ["IKEA", 1],
    ["Nytt företag", 2],
    ["Volvo", 3],
    ["Saab", 4],
  ]);
  assert.equal(new Set(apps.map(({ rank }) => rank)).size, apps.length);

  assert.equal(store.saveApplication({ company: "Saab", rank: "1" }, apps[3].id).ok, true);
  apps = sortApplications(store.getState().applications);
  assert.deepEqual(apps.map(({ company, rank }) => [company, rank]), [
    ["Saab", 1],
    ["IKEA", 2],
    ["Nytt företag", 3],
    ["Volvo", 4],
  ]);
  assert.equal(new Set(apps.map(({ rank }) => rank)).size, apps.length);
});

test("company matching ignores case and whitespace; selected Excel conflicts preserve identity", () => {
  const store = createTestStore();
  store.load();
  store.saveApplication({ company: "IKEA", city: "Älmhult" });
  const existing = store.getState().applications[0];
  const imported = [
    { ...existing, id: "new-id", company: " ikea ", city: "Stockholm", createdAt: "excel-created", updatedAt: "excel-updated" },
    { id: "fresh-id", rank: null, company: "Volvo", city: "", contactPerson: "", email: "", phone: "", motivation: "", notes: "", createdAt: "new", updatedAt: "new" },
  ];
  const { fresh, conflicts } = planImport(store.getState().applications, imported);
  assert.equal(fresh.length, 1);
  assert.equal(conflicts.length, 1);
  const result = store.applyImport(fresh, conflicts, ["excel"]);
  assert.deepEqual([result.added, result.updated, result.kept], [1, 1, 0]);
  const ikea = store.getState().applications.find((app) => app.company === "ikea");
  assert.equal(ikea.id, existing.id);
  assert.equal(ikea.createdAt, existing.createdAt);
  assert.equal(ikea.city, "Stockholm");
});

test("filters combine with AND and rank colors honor the 50-application threshold", () => {
  const filters = createFilters();
  filters.email = "missing";
  filters.phone = "has";
  assert.equal(matchesFilters({ email: "", phone: "123" }, filters), true);
  assert.equal(matchesFilters({ email: "a@b.se", phone: "123" }, filters), false);
  assert.equal(matchesFilters({ email: "", phone: "" }, filters), false);
  assert.equal(tierFor(1, 49), "gold");
  assert.equal(tierFor(2, 49), "silver");
  assert.equal(tierFor(3, 49), "bronze");
  assert.equal(tierFor(4, 49), null);
  assert.equal(tierFor(5, 50), "premium");
  assert.equal(tierFor(6, 50), null);
});

test("store supports at least 250 records and keeps their order ranks unique", () => {
  const store = createTestStore();
  store.load();
  for (let i = 0; i < 250; i++) store.saveApplication({ company: `Företag ${i}` });
  const apps = sortApplications(store.getState().applications);
  assert.equal(apps.length, 250);
  assert.deepEqual(apps.map((app) => app.rank), Array.from({ length: 250 }, (_, i) => i + 1));
  assert.equal(store.move(apps[249].id, apps[0].id, false), 1);
  assert.equal(sortApplications(store.getState().applications)[0].company, "Företag 249");
});
