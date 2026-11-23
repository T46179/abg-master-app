import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAppContext } from "../../app/AppProvider";
import { useExamSitting } from "../exam/ExamSittingContext";
import { ExamSitting } from "../exam/ExamSitting";
import { prepareExamQuestions } from "../exam/sittingModel";
import { ExamDashboard } from "../exam/ExamDashboard";
import { ExamHistory, ExamResults } from "../exam/ExamReview";
import { initialPrototypeState, mockHistory, mockLatestResult } from "../exam/mockData";
import { filterAttempts } from "../exam/presentationModel";
import type { ExamPrototypeState } from "../exam/presentationTypes";
import "../exam/exam.css";

const DemoResults = import.meta.env.DEV ? lazy(() => import("../exam/ExamResultsPrototype.dev")) : null;
const DemoErrorLog = import.meta.env.DEV ? lazy(() => import("../exam/ExamErrorLogPrototype.dev")) : null;
const DemoLatestResult = import.meta.env.DEV ? lazy(() => import("../exam/ExamLatestResultPreview.dev")) : null;

export function ExamScreen() {
  const { state: appState, patchSessionState } = useAppContext();
  const { sitting, dispatch } = useExamSitting();
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState("");
  const mounted = useRef(true);
  const launchingRef = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; dispatch({ type: "exit" }); };
  }, [dispatch]);
  async function beginDemo() {
    if (!import.meta.env.DEV || launchingRef.current) return;
    launchingRef.current = true;
    setLaunching(true);
    setLaunchError("");
    const pressureUnit = appState.sessionState?.pressureUnit ?? "mmHg";
    try {
      const { demoQuestions } = await import("../exam/demoFixtures.dev");
      if (mounted.current) dispatch({ type: "start", questions: prepareExamQuestions(demoQuestions), pressureUnit, now: Date.now() });
    } catch {
      if (mounted.current) setLaunchError("The demo could not be loaded. Please try again.");
    } finally {
      launchingRef.current = false;
      if (mounted.current) setLaunching(false);
    }
  }
  const location = useLocation();
  const navigate = useNavigate();
  const [settings, setState] = useState<ExamPrototypeState>(() => ({ ...initialPrototypeState }));

  const state = { ...settings, view: location.state?.examPrototypeView ?? initialPrototypeState.view };

  function updateState(patch: Partial<ExamPrototypeState>) {
    if (patch.view && patch.view !== state.view) {
      void navigate(location.pathname + location.search + location.hash, { state: { ...location.state, examPrototypeView: patch.view } });
    }
    setState(current => ({ ...current, ...patch }));
  }

  if (sitting?.phase === "complete" && DemoResults) return <main className="app-shell__page exam-screen"><Suspense fallback={<p>Loading exam explanations…</p>}><DemoResults sitting={sitting} pressureUnit={appState.sessionState?.pressureUnit ?? sitting.pressureUnit} onExit={() => dispatch({ type: "exit" })} /></Suspense></main>;

  if (sitting) return <main className="app-shell__page exam-screen"><ExamSitting sitting={sitting} dispatch={dispatch} /></main>;

  return (
    <main className="app-shell__page exam-screen">
      {launchError && <p role="alert">{launchError}</p>}
      {state.view === "exam" && (
        <ExamDashboard
          pressureUnit={appState.sessionState?.pressureUnit ?? "mmHg"}
          onPressureUnitChange={pressureUnit => {
            patchSessionState({ pressureUnit });
            appState.storage?.savePressureUnitPreference(pressureUnit);
          }}
          state={state}
          minutesPerCase={12}
          onChange={updateState}
          onBegin={import.meta.env.DEV ? beginDemo : undefined}
          launching={launching}
          errorLogCount={import.meta.env.DEV ? 5 : undefined}
        />
      )}
      {state.view === "results" && (DemoLatestResult ?
        <Suspense fallback={<p>Loading exam explanations…</p>}><DemoLatestResult pressureUnit={appState.sessionState?.pressureUnit ?? "mmHg"} onExit={() => updateState({ view: "exam" })} /></Suspense> : (
        <ExamResults
          result={mockLatestResult}
          onHistory={() => updateState({ view: "history" })}
        />
      ))}
      {state.view === "error-log" && DemoErrorLog && <Suspense fallback={<p>Loading error log…</p>}>
        <DemoErrorLog onOpenResult={() => updateState({ view: "results" })} />
      </Suspense>}
      {state.view === "history" && (
        <ExamHistory
          history={mockHistory}
          attempts={filterAttempts(mockHistory.attempts, state.historyFilter)}
          filter={state.historyFilter}
          onFilterChange={historyFilter => updateState({ historyFilter })}
          onOpen={() => updateState({ view: "results" })}
        />
      )}
    </main>
  );
}
