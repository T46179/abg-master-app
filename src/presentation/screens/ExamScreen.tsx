import { useEffect, useRef, useState } from "react";
import { useAppContext } from "../../app/AppProvider";
import { useExamSitting } from "../exam/ExamSittingContext";
import { ExamSitting } from "../exam/ExamSitting";
import { ExamDashboard } from "../exam/ExamDashboard";
import { ExamHistory, ExamResults } from "../exam/ExamReview";
import { initialPrototypeState, mockDrills, mockHistory, mockLatestResult, prototypeConfig } from "../exam/mockData";
import { buildSetupPresentation, filterAttempts } from "../exam/presentationModel";
import type { ExamPrototypeState } from "../exam/presentationTypes";
import "../exam/exam.css";

export function ExamScreen() {
  const { state: appState } = useAppContext();
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
      if (mounted.current) dispatch({ type: "start", questions: demoQuestions, pressureUnit, now: Date.now() });
    } catch {
      if (mounted.current) setLaunchError("The demo could not be loaded. Please try again.");
    } finally {
      launchingRef.current = false;
      if (mounted.current) setLaunching(false);
    }
  }
  const [state, setState] = useState<ExamPrototypeState>(() => ({ ...initialPrototypeState }));

  function updateState(patch: Partial<ExamPrototypeState>) {
    setState(current => ({ ...current, ...patch }));
  }

  function selectDrill(key: string) {
    const drill = mockDrills.find(item => item.key === key);
    if (!drill) return;
    updateState({ selectedDrill: key, selectedRule: drill.rules?.[0]?.key ?? "" });
  }

  const setup = buildSetupPresentation(state.questionCount, state.caseCount, state.timed, prototypeConfig);

  if (sitting) return <main className="app-shell__page exam-screen"><ExamSitting sitting={sitting} dispatch={dispatch} /></main>;

  return (
    <main className="app-shell__page exam-screen">
      {launchError && <p role="alert">{launchError}</p>}
      {state.view === "exam" && (
        <ExamDashboard
          state={state}
          drills={mockDrills}
          config={prototypeConfig}
          setup={setup}
          onChange={updateState}
          onSelectDrill={selectDrill}
          onBegin={import.meta.env.DEV ? beginDemo : undefined}
          launching={launching}
        />
      )}
      {state.view === "results" && (
        <ExamResults
          result={mockLatestResult}
          onBack={() => updateState({ view: "exam" })}
          onHistory={() => updateState({ view: "history" })}
        />
      )}
      {state.view === "history" && (
        <ExamHistory
          history={mockHistory}
          attempts={filterAttempts(mockHistory.attempts, state.historyFilter)}
          filter={state.historyFilter}
          onFilterChange={historyFilter => updateState({ historyFilter })}
          onBack={() => updateState({ view: "exam" })}
          onOpen={() => updateState({ view: "results" })}
        />
      )}
    </main>
  );
}
