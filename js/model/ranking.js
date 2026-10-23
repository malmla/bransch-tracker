export const PREMIUM_THRESHOLD = 50;

const collator = new Intl.Collator("sv");
const rankOf = (app) => (Number.isFinite(app.rank) ? app.rank : Infinity);

export function compareApplications(a, b) {
  const ra = rankOf(a);
  const rb = rankOf(b);
  if (ra !== rb) return ra < rb ? -1 : 1;
  return collator.compare(a.company, b.company);
}

export const sortApplications = (apps) => [...apps].sort(compareApplications);

/** Gold/silver/bronze below 50 applications, a single premium tier for ranks 1-5 from 50 up. */
export function tierFor(rank, total) {
  if (total >= PREMIUM_THRESHOLD) return rank >= 1 && rank <= 5 ? "premium" : null;
  return { 1: "gold", 2: "silver", 3: "bronze" }[rank] ?? null;
}

export const priorityLimit = (total) => (total >= PREMIUM_THRESHOLD ? 30 : 15);

/** Moves `id` next to `targetId` in an ordered id list. Returns null when nothing would change. */
export function moveInOrder(ids, id, targetId, after) {
  if (id === targetId || !ids.includes(id) || !ids.includes(targetId)) return null;
  const rest = ids.filter((x) => x !== id);
  rest.splice(rest.indexOf(targetId) + (after ? 1 : 0), 0, id);
  return rest.every((x, i) => x === ids[i]) ? null : rest;
}

export function nextRank(apps, excludeId) {
  let max = 0;
  for (const app of apps) {
    if (app.id !== excludeId && Number.isFinite(app.rank) && app.rank > max) max = app.rank;
  }
  return max + 1;
}

/**
 * Gives every application the rank matching its place in `orderedIds` (1, 2, 3 ...).
 * Only applications whose rank changed get a new `updatedAt`, except those in `keepTimestamp`.
 */
export function assignRanks(apps, orderedIds, now, keepTimestamp = new Set()) {
  const position = new Map(orderedIds.map((id, i) => [id, i + 1]));
  return apps.map((app) => {
    const rank = position.get(app.id);
    if (rank === undefined || rank === app.rank) return app;
    return { ...app, rank, updatedAt: keepTimestamp.has(app.id) ? app.updatedAt : now };
  });
}
