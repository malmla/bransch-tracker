import { sortApplications } from "../model/ranking.js";
import { isFilled, isValidEmail } from "../utils/text.js";

function grade(value, pass, distinction) {
  if (value >= distinction) return "distinction";
  if (value >= pass) return "pass";
  return "below";
}

const GRADE_LABELS = {
  below: "Under godkänt",
  pass: "Godkänt",
  distinction: "Väl godkänt",
};

export function getDashboardMetrics(applications) {
  const contacts = applications.filter(
    (app) => isFilled(app.contactPerson) && !isValidEmail(String(app.contactPerson).trim()),
  ).length;
  const ranked = sortApplications(applications);
  const topThree = ranked.slice(0, 3).filter((app) => isFilled(app.motivation)).length;
  const topFive = ranked.slice(0, 5).filter((app) => isFilled(app.motivation)).length;

  return {
    companies: {
      value: applications.length,
      target: applications.length < 30 ? 30 : 50,
      grade: grade(applications.length, 30, 50),
    },
    contacts: {
      value: contacts,
      target: contacts < 15 ? 15 : 30,
      grade: grade(contacts, 15, 30),
    },
    top: {
      topThree,
      topFive,
      value: topThree < 3 ? topThree : topFive,
      target: topThree < 3 ? 3 : 5,
      grade: topFive === 5 ? "distinction" : topThree === 3 ? "pass" : "below",
    },
  };
}

export function createDashboard(root) {
  const nodes = new Map([...root.querySelectorAll("[data-stat]")].map((n) => [n.dataset.stat, n]));
  const cards = new Map([...root.querySelectorAll("[data-goal]")].map((n) => [n.dataset.goal, n]));

  return {
    update(applications) {
      const metrics = getDashboardMetrics(applications);
      nodes.get("companies").textContent = `${metrics.companies.value} av ${metrics.companies.target}`;
      nodes.get("contacts").textContent = `${metrics.contacts.value} av ${metrics.contacts.target}`;
      nodes.get("top").textContent = `${metrics.top.value} av ${metrics.top.target}`;

      for (const [key, metric] of Object.entries(metrics)) {
        cards.get(key).dataset.status = metric.grade;
        nodes.get(`${key}Grade`).textContent = GRADE_LABELS[metric.grade];
      }
    },
  };
}
