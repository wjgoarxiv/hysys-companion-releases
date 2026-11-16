import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { DemoBanner } from "./mock/DemoBanner";
import { initializeLocale } from "./i18n";
import { themeStore } from "./state/prefs";
import "./theme/tokens.css";
import "./theme/components.css";
import "./theme/fonts.css";
import "./theme/terminal.css";
import "./theme/workbench.css";
import "./boot/boot.css";

initializeLocale();
themeStore.init();

createRoot(document.getElementById("workbench-root")!).render(
  <StrictMode>
    <DemoBanner />
    <App />
  </StrictMode>,
);
