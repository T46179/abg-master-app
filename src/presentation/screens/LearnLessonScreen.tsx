import { useEffect, useRef, useState } from "react";
import type { CSSProperties, MouseEvent } from "react";
import { ArrowLeft } from "lucide-react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAppContext } from "../../app/AppProvider";
import { trackEvent } from "../../core/analytics";
import { getAwardableXp, getLevelProgress, syncUserStateDerivedFields } from "../../core/progression";
import { getLearnLevel, isLearnLevelAvailable, isLearnLevelUnlocked, shouldShowLearnLevel } from "../learn/content";
import type { SpeedCheckPhase } from "../learn/SpeedCheckGame";
import { SpeedCheckGame } from "../learn/SpeedCheckGame";
import { cn } from "../utils";
import { Surface } from "../primitives/Surface";
import { ErrorView, LoadingView } from "../shared/StatusViews";

interface SpeedCheckResult {
  correctCount: number;
  totalQuestions: number;
  elapsedMs: number;
}

function getLearnLessonStorageKey(slug: string) {
  return `abg-master:learn:${slug}:lesson-index`;
}

function getLastLearnModuleStorageKey() {
  return "abg-master:learn:last-module";
}

function readStoredLessonIndex(slug: string, lessonCount: number) {
  if (typeof window === "undefined") return 0;

  const rawIndex = window.localStorage.getItem(getLearnLessonStorageKey(slug));
  const parsedIndex = Number(rawIndex);
  if (!Number.isInteger(parsedIndex)) return 0;

  return Math.max(0, Math.min(lessonCount - 1, parsedIndex));
}

function getEntryLessonIndex(slug: string, lessonCount: number, mode: string | null) {
  if (mode === "start" || mode === "review") return 0;
  return readStoredLessonIndex(slug, lessonCount);
}

function saveStoredLessonIndex(slug: string, lessonIndex: number) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(getLearnLessonStorageKey(slug), String(lessonIndex));
}

export function LearnLessonScreen() {
  const { state, setUserState } = useAppContext();
  const navigate = useNavigate();
  const { difficulty } = useParams<{ difficulty: string }>();
  const [searchParams] = useSearchParams();
  const level = getLearnLevel(difficulty);
  const entryMode = searchParams.get("mode");
  const [lessonIndex, setLessonIndex] = useState(() => level ? getEntryLessonIndex(level.slug, level.lessons.length, entryMode) : 0);
  const [speedCheckPhase, setSpeedCheckPhase] = useState<SpeedCheckPhase>("ready");
  const [speedCheckResetKey, setSpeedCheckResetKey] = useState(0);
  const [completionGateSatisfied, setCompletionGateSatisfied] = useState(false);
  const learnModuleStartedTrackedRef = useRef(new Set<string>());
  const analyticsSource = searchParams.get("source") ?? undefined;

  useEffect(() => {
    if (!level) {
      setLessonIndex(0);
      return;
    }

    const nextLessonIndex = getEntryLessonIndex(level.slug, level.lessons.length, entryMode);
    setLessonIndex(nextLessonIndex);
    if (entryMode === "start" || entryMode === "review") {
      saveStoredLessonIndex(level.slug, nextLessonIndex);
    }
    setSpeedCheckPhase("ready");
    setSpeedCheckResetKey(0);
  }, [difficulty, entryMode, level]);

  useEffect(() => {
    if (!level || typeof window === "undefined") return;

    window.localStorage.setItem(getLastLearnModuleStorageKey(), level.slug);
    saveStoredLessonIndex(level.slug, lessonIndex);
  }, [lessonIndex, level]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [lessonIndex]);

  useEffect(() => {
    if (state.status !== "ready" || !level) return;
    if (!shouldShowLearnLevel(level, state.userState.level) || !isLearnLevelUnlocked(level, state.userState.level) || !isLearnLevelAvailable(level)) return;
    if (state.userState.learnProgress?.[level.slug]) return;

    void setUserState({
      ...state.userState,
      learnProgress: {
        ...state.userState.learnProgress,
        [level.slug]: {
          completedLessonCount: 0,
          completed: false
        }
      }
    });
  }, [level, setUserState, state.status, state.userState]);

  useEffect(() => {
    if (state.status !== "ready" || !level) return;
    if (!["foundations", "beginner", "intermediate"].includes(level.slug)) return;
    if (!shouldShowLearnLevel(level, state.userState.level) || !isLearnLevelUnlocked(level, state.userState.level) || !isLearnLevelAvailable(level)) return;
    if (learnModuleStartedTrackedRef.current.has(level.slug)) return;

    learnModuleStartedTrackedRef.current.add(level.slug);
    trackEvent("learn_module_started", {
      module: level.slug,
      difficulty: level.slug,
      ...(analyticsSource ? { source: analyticsSource } : {})
    });
  }, [analyticsSource, level, state.status, state.userState.level]);

  useEffect(() => {
    setCompletionGateSatisfied(false);
  }, [difficulty, lessonIndex]);

  useEffect(() => {
    function handleCompletionGate(event: Event) {
      const detail = (event as CustomEvent<{ complete?: boolean }>).detail;
      setCompletionGateSatisfied(Boolean(detail?.complete));
    }

    window.addEventListener("abg-master:learn:completion-gate", handleCompletionGate);
    return () => window.removeEventListener("abg-master:learn:completion-gate", handleCompletionGate);
  }, []);

  if (state.status === "loading" || state.status === "idle") return <LoadingView />;
  if (state.status === "error") return <ErrorView message={state.errorMessage} />;
  if (!level) return <Navigate to="/learn" replace />;
  if (!shouldShowLearnLevel(level, state.userState.level) || !isLearnLevelUnlocked(level, state.userState.level) || !isLearnLevelAvailable(level)) {
    return <Navigate to="/learn" replace />;
  }

  const activeLevel = level;
  const lesson = activeLevel.lessons[lessonIndex];
  const isLastLesson = lessonIndex === activeLevel.lessons.length - 1;
  const isSpeedCheck = lesson.kind === "speed-check";
  const canAdvanceLesson = !lesson.requiresCompletionGate || completionGateSatisfied;
  const showFooterPracticeCta = !isSpeedCheck && isLastLesson && Boolean(lesson.ctaHref && lesson.ctaLabel);
  const levelProgress = getLevelProgress(state.payload?.progressionConfig ?? null, state.userState);
  const moduleProgress = state.userState.learnProgress?.[activeLevel.slug];
  const canSkipSpeedCheck = isSpeedCheck && Boolean(
    moduleProgress?.bestSpeedCheckResult ||
    (moduleProgress?.completedLessonCount ?? 0) > lessonIndex
  );
  const highestSelectableLessonIndex = moduleProgress?.completed
    ? activeLevel.lessons.length - 1
    : Math.max(lessonIndex, moduleProgress?.completedLessonCount ?? 0);
  const lessonStyle = {
    "--learn-card-accent-light": activeLevel.palette.accentLight,
    "--learn-card-accent-dark": activeLevel.palette.accentDark
  } as CSSProperties;

  function getNextLessonUserState(options?: { completeModule?: boolean }) {
    const completedLessonCount = lessonIndex + 1;
    const currentProgress = state.userState.learnProgress?.[activeLevel.slug];
    const nextCompleted = Boolean(options?.completeModule || currentProgress?.completed);
    const nextCompletedLessonCount = nextCompleted
      ? activeLevel.lessons.length
      : Math.max(currentProgress?.completedLessonCount ?? 0, completedLessonCount);

    if (
      currentProgress?.completed === nextCompleted &&
      currentProgress?.completedLessonCount === nextCompletedLessonCount
    ) {
      return null;
    }

    return {
      ...state.userState,
      learnProgress: {
        ...state.userState.learnProgress,
        [activeLevel.slug]: {
          ...currentProgress,
          completedLessonCount: nextCompletedLessonCount,
          completed: nextCompleted
        }
      }
    };
  }

  function handleNextLesson() {
    const nextUserState = getNextLessonUserState({ completeModule: isLastLesson });
    if (nextUserState) void setUserState(nextUserState);

    if (isLastLesson) {
      navigate("/learn?all=1");
      return;
    }

    setLessonIndex(index => index + 1);
  }

  async function handleFooterPracticeCtaClick(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();

    const nextUserState = getNextLessonUserState({ completeModule: true });
    if (nextUserState) {
      await setUserState(nextUserState);
    }

    navigate(lesson.ctaHref ?? "/practice?difficulty=beginner");
  }

  function handlePreviousLesson() {
    if (isSpeedCheck && speedCheckPhase !== "ready") {
      setSpeedCheckResetKey(key => key + 1);
      setSpeedCheckPhase("ready");
      return;
    }

    if (lessonIndex === 0) {
      navigate("/learn");
      return;
    }

    setLessonIndex(index => Math.max(0, index - 1));
  }

  function handleSelectLesson(nextLessonIndex: number) {
    setLessonIndex(nextLessonIndex);
    setSpeedCheckPhase("ready");
    setSpeedCheckResetKey(key => key + 1);
  }

  function handleSpeedCheckXpAwarded(amount: number) {
    const awardedXp = getAwardableXp(state.payload?.progressionConfig ?? null, state.userState.xp, amount);
    if (!awardedXp) return;

    void setUserState(syncUserStateDerivedFields({
      ...state.userState,
      xp: state.userState.xp + awardedXp
    }, state.payload?.progressionConfig ?? null));
  }

  function handleSpeedCheckResult(result: SpeedCheckResult) {
    const currentProgress = state.userState.learnProgress?.[activeLevel.slug];
    const currentBest = currentProgress?.bestSpeedCheckResult;
    const isBetterResult =
      !currentBest ||
      result.correctCount > currentBest.correctCount ||
      (result.correctCount === currentBest.correctCount && result.elapsedMs < currentBest.elapsedMs);

    if (!isBetterResult) return;

    void setUserState({
      ...state.userState,
      learnProgress: {
        ...state.userState.learnProgress,
        [activeLevel.slug]: {
          ...currentProgress,
          completedLessonCount: currentProgress?.completedLessonCount ?? 0,
          completed: currentProgress?.completed ?? false,
          bestSpeedCheckResult: result
        }
      }
    });
  }

  return (
    <main className="app-shell__page learn-deck-screen">
      <div className="learn-deck">
        <div className="learn-deck__header-bar">
          <Link className="learn-deck__back-link" to="/learn?all=1">
            <ArrowLeft />
            <span>All modules</span>
          </Link>
        </div>

        <Surface className={cn("learn-deck__surface", `learn-deck__surface--${activeLevel.slug}`)} style={lessonStyle}>
          <header className="learn-deck__header">
            <div className="learn-deck__header-top">
              <span className="learn-deck__eyebrow">{activeLevel.title}</span>
              <div className="learn-progress-dots" aria-label="Lesson progress">
                {activeLevel.lessons.map((item, index) => {
                  const stateName = index === lessonIndex ? "current" : index < lessonIndex ? "complete" : "upcoming";
                  const canSelectLesson = index <= highestSelectableLessonIndex;
                  const dotClassName = cn("learn-progress-dots__dot", `is-${stateName}`, canSelectLesson && "is-selectable");
                  const dotLabel = `Go to lesson ${index + 1} of ${activeLevel.lessons.length}: ${item.title}`;

                  if (canSelectLesson) {
                    return (
                      <button
                        key={`${item.title}-${index}`}
                        className={dotClassName}
                        type="button"
                        data-state={stateName}
                        aria-label={dotLabel}
                        aria-current={index === lessonIndex ? "step" : undefined}
                        onClick={() => handleSelectLesson(index)}
                      />
                    );
                  }

                  return (
                    <span
                      key={`${item.title}-${index}`}
                      className={dotClassName}
                      data-state={stateName}
                      aria-label={`Lesson ${index + 1} of ${activeLevel.lessons.length}`}
                    />
                  );
                })}
              </div>
            </div>
            <h1>{lesson.title}</h1>
          </header>

          <div className="learn-deck__body">
            {isSpeedCheck ? (
              <SpeedCheckGame
                level={state.userState.level}
                onComplete={handleNextLesson}
                onPhaseChange={setSpeedCheckPhase}
                onResult={handleSpeedCheckResult}
                onXpAwarded={handleSpeedCheckXpAwarded}
                xpForNextLevel={levelProgress.xpForNextLevel}
                xpIntoLevel={levelProgress.xpIntoLevel}
                xpProgressLabel={`${levelProgress.xpIntoLevel} / ${levelProgress.xpForNextLevel || levelProgress.xpIntoLevel} XP`}
                xpProgressValue={levelProgress.progressPercent}
                resetKey={speedCheckResetKey}
              />
            ) : (
              lesson.content
            )}
          </div>

          {!isSpeedCheck && lesson.ctaHref && lesson.ctaLabel && !showFooterPracticeCta ? (
            <div className="learn-deck__cta-row">
              <Link className="figma-button figma-button--secondary learn-deck__cta" to={lesson.ctaHref}>
                {lesson.ctaLabel}
              </Link>
            </div>
          ) : null}

          <footer className={cn("learn-deck__footer", isSpeedCheck && "is-compact")}>
            {lessonIndex > 0 ? (
              <button
                className="figma-button figma-button--secondary"
                type="button"
                onClick={handlePreviousLesson}
              >
                Back
              </button>
            ) : null}

            <div className="learn-deck__footer-actions">
              {showFooterPracticeCta && lesson.ctaHref ? (
                <Link className="figma-button figma-button--secondary" to={lesson.ctaHref} onClick={handleFooterPracticeCtaClick}>
                  {lesson.ctaLabel}
                </Link>
              ) : null}

              {!isSpeedCheck && canAdvanceLesson ? (
                <button className="figma-button" type="button" onClick={handleNextLesson}>
                  {isLastLesson ? "Finish lesson" : "Next"}
                </button>
              ) : canSkipSpeedCheck ? (
                <button className="figma-button" type="button" onClick={handleNextLesson}>
                  Skip
                </button>
              ) : null}
            </div>
          </footer>
        </Surface>
      </div>
    </main>
  );
}
