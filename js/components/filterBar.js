/** Filter controls opt in with data-filter="<field>". */
export function createFilterBar(
  root,
  { resetButton, info, onChange, onUse, onReset },
) {
  const selects = [...root.querySelectorAll("select[data-filter]")];
  const inputs = [...root.querySelectorAll("input[data-filter]")];

  for (const select of selects) {
    select.addEventListener("change", () => {
      onChange(select.dataset.filter, select.value);
      onUse(select.dataset.filter, select.value);
    });
  }
  for (const input of inputs) {
    input.addEventListener("input", () => onChange(input.dataset.filter, input.value));
    input.addEventListener("change", () => onUse(input.dataset.filter));
  }
  resetButton.addEventListener("click", onReset);

  return {
    update({ filters, filtering, shown, total }) {
      for (const select of selects) select.value = filters[select.dataset.filter] ?? "";
      for (const input of inputs) {
        const value = filters[input.dataset.filter] ?? "";
        if (input.value !== value) input.value = value;
      }
      resetButton.hidden = !filtering;
      info.textContent = filtering ? `Visar ${shown} av ${total}` : "";
    },
  };
}
