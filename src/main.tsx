import "./styles/theme.css";
import "./styles/index.css";
const container = document.getElementById("root");
if (!container) throw new Error("Root container not found.");
if (import.meta.env.DEV && location.pathname === "/dev/status-preview") {
  void import("./dev/statusPreview").then(({ mountStatusPreview }) => mountStatusPreview(container));
} else if (import.meta.env.DEV && import.meta.env.MODE === "account-staging") {
  void import("./dev/accountStagingApp").then(({ mountAccountStagingApp }) => mountAccountStagingApp(container));
} else if (import.meta.env.DEV && import.meta.env.MODE === "development" && import.meta.env.VITE_SUPABASE_URL === "https://clpfecuohwzwrgmqzeos.supabase.co" && ["127.0.0.1", "localhost"].includes(location.hostname)) {
  void import("./dev/localAccountEntry").then(({ mountLocalAccountApp }) => mountLocalAccountApp(container));
} else {
  void import("./app/mountDefaultApp").then(({ mountDefaultApp }) => mountDefaultApp(container));
}
