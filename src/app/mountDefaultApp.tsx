import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppProvider } from "./AppProvider";
import { App } from "./App";
import { handleCaughtReactError, initMonitoring } from "../core/monitoring";
import { initAnalytics } from "../core/analytics";
export function mountDefaultApp(container: HTMLElement) {
  initMonitoring(); initAnalytics();
  createRoot(container, { onCaughtError: handleCaughtReactError }).render(<StrictMode><AppProvider><App /></AppProvider></StrictMode>);
}
