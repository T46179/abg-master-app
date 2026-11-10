import { useEffect, useState } from "react";
import { loadPublicCasesSolvedCount } from "../../core/publicSiteMetrics";

export function usePublicCasesSolvedCount() {
  const [casesSolvedCount, setCasesSolvedCount] = useState(0);
  const [casesSolvedLoaded, setCasesSolvedLoaded] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const count = await loadPublicCasesSolvedCount(controller.signal);
        if (controller.signal.aborted || count === null) return;
        setCasesSolvedCount(count);
        setCasesSolvedLoaded(true);
      } catch {
        // Keep the placeholder if the public metric is unavailable.
      }
    }
    void load();
    return () => controller.abort();
  }, []);

  return { casesSolvedCount, casesSolvedLoaded };
}
