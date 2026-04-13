import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppProvider } from "./app/AppProvider";
import { App } from "./app/App";
import { initMonitoring } from "./core/monitoring";
import { initAnalytics } from "./core/analytics";
import "./styles/theme.css";
import "./styles/index.css";

initMonitoring();

const container = document.getElementById("root");

if (!container) {
  throw new Error("Root container not found.");
}

initAnalytics();

createRoot(container).render(
  <StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </StrictMode>
);
