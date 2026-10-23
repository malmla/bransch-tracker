import { isFilled } from "../utils/text.js";

/** Summary tiles. Elements opt in with data-stat="total|contactPerson|email|motivation". */
export function createDashboard(root) {
  const nodes = new Map([...root.querySelectorAll("[data-stat]")].map((n) => [n.dataset.stat, n]));

  return {
    update(applications) {
      const counts = { total: applications.length, contactPerson: 0, email: 0, motivation: 0 };
      for (const app of applications) {
        if (isFilled(app.contactPerson)) counts.contactPerson++;
        if (isFilled(app.email)) counts.email++;
        if (isFilled(app.motivation)) counts.motivation++;
      }
      for (const [key, node] of nodes) node.textContent = counts[key] ?? 0;
    },
  };
}
