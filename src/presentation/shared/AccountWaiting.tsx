import { useEffect, useState } from "react";

export function AccountWaiting({ retry, error, attempt = 0 }: { retry: () => void; error?: string; attempt?: number }) {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    setStage(0);
    const connecting = setTimeout(() => setStage(1), 3000);
    const slow = setTimeout(() => setStage(2), 15000);
    return () => { clearTimeout(connecting); clearTimeout(slow); };
  }, [attempt, error]);
  return <div className="loading-chip" role="status" aria-live="polite" aria-label="Loading account">
    {!error && <span className="loading-chip__spinner" aria-hidden="true" />}
    <span>{error ?? (stage === 2 ? "This is taking longer than usual." : stage === 1 ? "Connecting…" : "")}</span>
    {(error || stage === 2) && <button type="button" onClick={retry}>Retry</button>}
  </div>;
}
