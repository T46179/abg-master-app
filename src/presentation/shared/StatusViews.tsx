import type { ReactNode } from "react";
import { Surface } from "../primitives/Surface";

function ErrorScreen({ title, children }: { title: string; children: ReactNode }) {
  const refreshHref = typeof window === "undefined" ? "/" : window.location.href;
  return (
    <main className="app-shell__page status-screen status-screen--error">
      <div className="status-error-layout">
        <a className="status-error-brand" href="/">ABG Master</a>
        <Surface className="status-panel status-panel--error" aria-labelledby="status-error-title">
          <span className="status-panel__eyebrow">A quick reset</span>
          <h1 id="status-error-title">{title}</h1>
          <p>{children}</p>
          <a className="status-panel__refresh" href={refreshHref}>Refresh</a>
          <p className="status-panel__help">If this keeps happening, please try again in a few minutes.</p>
        </Surface>
      </div>
    </main>
  );
}

export function LoadingView() {
  return (
    <main className="app-shell__page status-screen status-screen--loading">
      <div className="loading-chip" role="status" aria-live="polite">
        <span className="loading-chip__spinner" aria-hidden="true" />
        <span>Loading…</span>
      </div>
    </main>
  );
}

export function ErrorView({ message }: { message: string | null }) {
  return (
    <ErrorScreen title="Unable to start ABG Master">
      {message ?? "We couldn’t load ABG Master. Please refresh and try again."}
    </ErrorScreen>
  );
}

export function AppRouteErrorView() {
  return (
    <ErrorScreen title="Let’s get you back on track">
      We couldn’t load this page. Refresh ABG Master to continue.
    </ErrorScreen>
  );
}
