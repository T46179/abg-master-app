import { Surface } from "../primitives/Surface";

export function LoadingView() {
  return (
    <main className="app-shell__page status-screen status-screen--loading">
      <div className="loading-chip" role="status" aria-live="polite">
        <span className="loading-chip__spinner" aria-hidden="true" />
        <span>Loading cases</span>
      </div>
    </main>
  );
}

export function ErrorView({ message }: { message: string | null }) {
  return (
    <main className="app-shell__page status-screen">
      <Surface className="status-panel">
        <span className="status-panel__eyebrow">App unavailable</span>
        <h1>Unable to start ABG Master</h1>
        <p>{message ?? "Something went wrong while starting ABG Master. Please refresh and try again."}</p>
      </Surface>
    </main>
  );
}

export function AppRouteErrorView() {
  const refreshHref = typeof window === "undefined" ? "/" : window.location.href;

  return (
    <main className="app-shell__page status-screen">
      <Surface className="status-panel">
        <span className="status-panel__eyebrow">Something went wrong</span>
        <h1>ABG Master needs a refresh</h1>
        <p>The page changed unexpectedly. Refresh ABG Master to continue.</p>
        <a className="figma-button" href={refreshHref}>Refresh ABG Master</a>
      </Surface>
    </main>
  );
}
