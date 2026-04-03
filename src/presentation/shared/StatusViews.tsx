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
        <span className="status-panel__eyebrow">Frontend error</span>
        <h1>Unable to initialize the frontend</h1>
        <p>{message ?? "The frontend failed to initialize."}</p>
      </Surface>
    </main>
  );
}
