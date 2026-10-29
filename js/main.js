import { createAnnouncer, createStatus } from "./components/feedback.js";
import { createApplicationForm } from "./components/applicationForm.js";
import { createApplicationList } from "./components/applicationList.js";
import { createConflictDialog } from "./components/conflictDialog.js";
import { createDashboard } from "./components/dashboard.js";
import { createFilterBar } from "./components/filterBar.js";
import { createThemeToggle } from "./components/themeToggle.js";
import { isFiltering, matchesFilters } from "./model/filters.js";
import { planImport } from "./model/importPlan.js";
import { sortApplications, tierFor } from "./model/ranking.js";
import {
  exportWorkbook,
  ExcelError,
  importWorkbook,
} from "./services/excel.js";
import { createStorage } from "./services/storage.js";
import { createStore } from "./state/store.js";
import { downloadBlob, writeBlobToFile } from "./utils/download.js";
import { must } from "./utils/dom.js";

const STORAGE_KEY = "lia-applications";

export function startApp() {
  const status = createStatus(must("status"));
  const announce = createAnnouncer(must("announcer"));

  const store = createStore({
    storage: createStorage(STORAGE_KEY),
    onSaveError: () =>
      status.show(
        [
          "Ändringen kunde inte sparas i webbläsaren (lagringen är full eller blockerad). Exportera till Excel för att inte förlora data.",
        ],
        "error",
      ),
  });

  createThemeToggle(must("theme-toggle"), {
    onError: () =>
      status.show(["Temainställningen kunde inte sparas lokalt."], "error"),
  });
  const dashboard = createDashboard(must("dashboard"));

  const form = createApplicationForm({
    form: must("application-form"),
    title: must("form-title"),
    submitButton: must("submit-btn"),
    cancelButton: must("cancel-btn"),
    summary: must("form-error"),
    onSubmit(values, id) {
      const result = store.saveApplication(values, id);
      if (result.ok) announce(id ? "Ansökan uppdaterad." : "Ansökan sparad.");
      return result;
    },
  });

  const filterBar = createFilterBar(must("filters"), {
    resetButton: must("filter-reset"),
    info: must("filter-info"),
    onChange: (field, mode) => store.setFilter(field, mode),
    onReset: () => store.resetFilters(),
  });

  const list = createApplicationList(must("list"), {
    emptyEl: must("empty"),
    announce,
    onEdit(id) {
      const app = store.getState().applications.find((a) => a.id === id);
      if (app) form.edit(app);
    },
    onDelete(id) {
      const app = store.getState().applications.find((a) => a.id === id);
      if (!app || !window.confirm(`Ta bort ${app.company || "företaget"}?`))
        return;
      store.remove(id);
      if (form.getEditingId() === id) form.reset();
      announce("Ansökan borttagen.");
      must("list-heading").focus();
    },
    onMove(id, targetId, after) {
      const rank = store.move(id, targetId, after);
      if (rank !== null) {
        const name =
          store.getState().applications.find((a) => a.id === id)?.company ||
          "Företaget";
        announce(`${name} flyttad till rang ${rank}.`);
      }
    },
  });

  const count = must("count");

  function render({ applications, filters }) {
    const total = applications.length;
    const filtering = isFiltering(filters);

    // Rank colors depend on each application's position in the full list, not the filtered list
    const visible = [];
    sortApplications(applications).forEach((app) => {
      if (matchesFilters(app, filters)) {
        visible.push({ app, tier: tierFor(app.rank, total) });
      }
    });

    count.textContent = total;
    dashboard.update(applications);
    filterBar.update({ filters, filtering, shown: visible.length, total });
    list.update(visible, { total, filtering });
  }

  store.subscribe(render);

  const problem = store.load();
  if (problem === "corrupt") {
    status.show(
      [
        "Sparad data kunde inte läsas och en säkerhetskopia har sparats i webbläsaren. Listan startade tom.",
      ],
      "error",
    );
  } else if (problem === "corrupt-backup-failed") {
    status.show(
      [
        "Sparad data kunde inte läsas och säkerhetskopian kunde inte sparas. Listan startade tom.",
      ],
      "error",
    );
  } else if (problem === "migration-save-failed") {
    status.show(
      [
        "Befintliga ansökningar kunde läsas, men uppdateringen av det lokala lagringsformatet kunde inte sparas.",
      ],
      "error",
    );
  } else if (problem === "unavailable") {
    status.show(
      [
        "LocalStorage är inte tillgängligt. Ändringar sparas inte när du lämnar sidan.",
      ],
      "error",
    );
  }

  const importButton = must("import-btn");
  const exportButton = must("export-btn");
  const fileInput = must("import-file");
  const conflictDialog = createConflictDialog(must("conflict-dialog"));
  const excelPickerOptions = {
    id: "lia-excel",
    types: [
      {
        description: "Excel",
        accept: {
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
            ".xlsx",
          ],
        },
      },
    ],
  };

  const busy = (button, on) => {
    button.disabled = on;
    button.setAttribute("aria-busy", String(on));
  };

  async function importFile(file) {
    busy(importButton, true);
    try {
      const imported = await importWorkbook(file);
      const { fresh, conflicts } = planImport(
        store.getState().applications,
        imported,
      );

      let choices = [];
      if (conflicts.length) {
        choices = await conflictDialog.ask(conflicts);
        if (!choices) {
          status.show(["Importen avbröts. Inga ändringar gjordes."]);
          return;
        }
      }

      const result = store.applyImport(fresh, conflicts, choices);
      if (!result.persisted) return;
      status.show(
        [
          `${result.added} nya ansökningar importerades.`,
          result.updated &&
            `${result.updated} befintliga ansökningar uppdaterades från Excel.`,
          result.kept &&
            `${result.kept} befintliga ansökningar behölls oförändrade.`,
          result.incomplete &&
            `${result.incomplete} har tomma fält, markerade med "saknas" i listan.`,
        ].filter(Boolean),
        "success",
      );
    } catch (error) {
      if (error instanceof ExcelError)
        status.show([error.message, ...error.details], "error");
      else {
        console.error(error);
        status.show(["Importen misslyckades oväntat. Försök igen."], "error");
      }
    } finally {
      busy(importButton, false);
    }
  }

  importButton.addEventListener("click", async () => {
    if (typeof window.showOpenFilePicker !== "function") {
      fileInput.click();
      return;
    }

    busy(importButton, true);
    try {
      const [handle] = await window.showOpenFilePicker({
        ...excelPickerOptions,
        multiple: false,
      });
      await importFile(await handle.getFile());
    } catch (error) {
      if (error.name !== "AbortError") {
        console.error(error);
        status.show(["Importen kunde inte öppnas. Försök igen."], "error");
      }
    } finally {
      busy(importButton, false);
    }
  });

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    fileInput.value = "";
    if (file) await importFile(file);
  });

  exportButton.addEventListener("click", async () => {
    const { applications } = store.getState();
    if (!applications.length) {
      status.show(["Det finns inga ansökningar att exportera."], "error");
      return;
    }
    busy(exportButton, true);
    try {
      const fileHandle =
        typeof window.showSaveFilePicker === "function"
          ? await window.showSaveFilePicker({
              ...excelPickerOptions,
              suggestedName: "lia-ansokningar.xlsx",
            })
          : null;
      const workbook = await exportWorkbook(applications);
      if (fileHandle) await writeBlobToFile(fileHandle, workbook);
      else downloadBlob(workbook, "lia-ansokningar.xlsx");
      status.clear();
    } catch (error) {
      if (error.name === "AbortError") return;
      console.error(error);
      status.show(
        [
          error instanceof ExcelError
            ? error.message
            : "Exporten misslyckades. Försök igen.",
        ],
        "error",
      );
    } finally {
      busy(exportButton, false);
    }
  });
}
