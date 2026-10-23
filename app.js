import { startApp } from "./js/main.js";

try {
  startApp();
} catch (error) {
  console.error(error);
  const box = document.getElementById("status");
  if (box) {
    box.hidden = false;
    box.className = "status status-error";
    box.textContent = "Appen kunde inte starta. Ladda om sidan.";
  }
}

window.addEventListener("unhandledrejection", (event) => console.error(event.reason));
