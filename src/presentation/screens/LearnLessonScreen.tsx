import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useAppContext } from "../../app/AppProvider";
import { getLearnLevel, isLearnLevelUnlocked, shouldShowLearnLevel } from "../learn/content";
import type { SpeedCheckPhase } from "../learn/SpeedCheckGame";
import { SpeedCheckGame } from "../learn/SpeedCheckGame";
import { cn } from "../utils";
import { Surface } from "../primitives/Surface";
import { ErrorView, LoadingView } from "../shared/StatusViews";

export function LearnLessonScreen() {
  const { state } = useAppContext();
  const navigate = useNavigate();
  const { difficulty } = useParams<{ difficulty: string }>();
  const level = getLearnLevel(difficulty);
  const [lessonIndex, setLessonIndex] = useState(0);
  const [speedCheckPhase, setSpeedCheckPhase] = useState<SpeedCheckPhase>("ready");

  useEffect(() => {
    setLessonIndex(0);
    setSpeedCheckPhase("ready");
  }, [difficulty]);

  if (state.status === "loading" || state.status === "idle") return <LoadingView />;
  if (state.status === "error") return <ErrorView message={state.errorMessage} />;
  if (!level) return <Navigate to="/learn" replace />;
  if (!shouldShowLearnLevel(level, state.userState.level) || !isLearnLevelUnlocked(level, state.userState.level)) {
    return <Navigate to="/learn" replace />;
  }

  const lesson = level.lessons[lessonIndex];
  const isLastLesson = lessonIndex === level.lessons.length - 1;
  const isSpeedCheck = lesson.kind === "speed-check";
  const disableBack = isSpeedCheck && speedCheckPhase === "playing";

  function handleNextLesson() {
    if (isLastLesson) {
      navigate("/learn");
      return;
    }

    setLessonIndex(index => index + 1);
  }

  function handlePreviousLesson() {
    if (lessonIndex === 0) {
      navigate("/learn");
      return;
    }

    setLessonIndex(index => Math.max(0, index - 1));
  }

  return (
    <main className="app-shell__page learn-deck-screen">
      <div className="learn-deck">
        <div className="learn-deck__header-bar">
          <Link className="learn-deck__back-link" to="/learn">
            <ArrowLeft />
            <span>All modules</span>
          </Link>
        </div>

        <Surface className="learn-deck__surface">
          <header className="learn-deck__header">
            <div className="learn-deck__header-top">
              <span className="learn-deck__eyebrow">{level.title}</span>
              <div className="learn-progress-dots" aria-label="Lesson progress">
                {level.lessons.map((item, index) => {
                  const stateName = index === lessonIndex ? "current" : index < lessonIndex ? "complete" : "upcoming";
                  return (
                    <span
                      key={`${item.title}-${index}`}
                      className={cn("learn-progress-dots__dot", `is-${stateName}`)}
                      data-state={stateName}
                      aria-label={`Lesson ${index + 1} of ${level.lessons.length}`}
                    />
                  );
                })}
              </div>
            </div>
            <h1>{lesson.title}</h1>
            <p>{level.subtitle}</p>
          </header>

          <div className="learn-deck__body">
            {isSpeedCheck ? (
              <SpeedCheckGame
                onComplete={handleNextLesson}
                onPhaseChange={setSpeedCheckPhase}
              />
            ) : (
              lesson.content
            )}
          </div>

          {!isSpeedCheck && lesson.ctaHref && lesson.ctaLabel ? (
            <div className="learn-deck__cta-row">
              <Link className="figma-button figma-button--secondary learn-deck__cta" to={lesson.ctaHref}>
                {lesson.ctaLabel}
              </Link>
            </div>
          ) : null}

          <footer className={cn("learn-deck__footer", isSpeedCheck && "is-compact")}>
            <button
              className="figma-button figma-button--secondary"
              type="button"
              onClick={handlePreviousLesson}
              disabled={disableBack}
            >
              {lessonIndex === 0 ? "Back to modules" : "Back"}
            </button>

            {!isSpeedCheck ? (
              <button className="figma-button" type="button" onClick={handleNextLesson}>
                {isLastLesson ? "Finish lesson" : "Next"}
              </button>
            ) : (
              <span className="learn-deck__footer-hint">
                Finish the speed check to continue.
              </span>
            )}
          </footer>
        </Surface>
      </div>
    </main>
  );
}
