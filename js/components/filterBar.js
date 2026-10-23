/** Select-based filters. Selects opt in with data-filter="<field>". */
export function createFilterBar(root, { resetButton, info, onChange, onReset }) {
  const selects = [...root.querySelectorAll("select[data-filter]")];

  for (const select of selects) {
    select.addEventListener("change", () => onChange(select.dataset.filter, select.value));
  }
  resetButton.addEventListener("click", onReset);

  return {
    update({ filters, filtering, shown, total }) {
      for (const select of selects) select.value = filters[select.dataset.filter] ?? "";
      resetButton.hidden = !filtering;
      info.textContent = filtering ? `Visar ${shown} av ${total}` : "";
    },
  };
}
