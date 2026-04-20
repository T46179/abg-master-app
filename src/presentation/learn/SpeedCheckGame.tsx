import { useEffect, useRef, useState, type CSSProperties } from "react";
import { cn } from "../utils";

export type SpeedCheckPhase = "ready" | "countdown" | "playing" | "results";

interface SpeedCheckGameProps {
  onComplete: () => void;
  onPhaseChange?: (phase: SpeedCheckPhase) => void;
  onXpAwarded?: (amount: number) => void;
  resetKey?: number;
  level?: number;
  xpForNextLevel?: number;
  xpIntoLevel?: number;
  xpProgressLabel?: string;
  xpProgressValue?: number;
}

interface SpeedCheckQuestion {
  ph: number;
  correct: "Normal" | "Acidaemia" | "Alkalaemia";
}

const SPEED_CHECK_QUESTION_COUNT = 10;
const SPEED_CHECK_XP_PER_CORRECT = 3;

const SPEED_CHECK_RANGES: Record<SpeedCheckQuestion["correct"], { min: number; max: number }> = {
  Acidaemia: { min: 7.1, max: 7.3 },
  Normal: { min: 7.37, max: 7.43 },
  Alkalaemia: { min: 7.5, max: 7.6 }
};

const SPEED_CHECK_PATTERN: SpeedCheckQuestion["correct"][] = [
  "Acidaemia",
  "Normal",
  "Alkalaemia",
  "Acidaemia",
  "Normal",
  "Alkalaemia",
  "Acidaemia",
  "Normal",
  "Alkalaemia",
  "Acidaemia"
];

function randomPhInRange(range: { min: number; max: number }) {
  const value = range.min + Math.random() * (range.max - range.min);
  return Number(value.toFixed(2));
}

function shuffleQuestions(questions: SpeedCheckQuestion[]) {
  const shuffled = [...questions];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

export function generateSpeedCheckQuestions(): SpeedCheckQuestion[] {
  return shuffleQuestions(
    SPEED_CHECK_PATTERN.slice(0, SPEED_CHECK_QUESTION_COUNT).map(correct => ({
      ph: randomPhInRange(SPEED_CHECK_RANGES[correct]),
      correct
    }))
  );
}

export const SPEED_CHECK_QUESTIONS: SpeedCheckQuestion[] = generateSpeedCheckQuestions();

export function SpeedCheckGame({
  level = 1,
  onComplete,
  onPhaseChange,
  onXpAwarded,
  resetKey = 0,
  xpForNextLevel = 0,
  xpIntoLevel = 0,
  xpProgressLabel = "0 / 0 XP",
  xpProgressValue = 0
}: SpeedCheckGameProps) {
  const gameRef = useRef<HTMLElement | null>(null);
  const xpCounterRef = useRef<HTMLElement | null>(null);
  const [phase, setPhase] = useState<SpeedCheckPhase>("ready");
  const [questions, setQuestions] = useState<SpeedCheckQuestion[]>(() => generateSpeedCheckQuestions());
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<boolean[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [startTime, setStartTime] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [xp, setXp] = useState(0);
  const [showBubble, setShowBubble] = useState(false);
  const [shakeXpCounter, setShakeXpCounter] = useState(false);
  const [shakePrompt, setShakePrompt] = useState(false);
  const [bubblePosition, setBubblePosition] = useState({ x: 0, y: 0, travelX: 0, travelY: 0 });
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    onPhaseChange?.(phase);
  }, [onPhaseChange, phase]);

  useEffect(() => {
    setPhase("ready");
    setCurrentQuestionIndex(0);
    setAnswers([]);
    setSelectedAnswer(null);
    setShowFeedback(false);
    setStartTime(0);
    setElapsedTime(0);
    setXp(0);
    setShowBubble(false);
    setShakeXpCounter(false);
    setShakePrompt(false);
    setCountdown(3);
  }, [resetKey]);

  useEffect(() => {
    if (phase !== "playing") return undefined;

    const intervalId = window.setInterval(() => {
      setElapsedTime(Date.now() - startTime);
    }, 100);

    return () => window.clearInterval(intervalId);
  }, [phase, startTime]);

  useEffect(() => {
    if (phase !== "countdown") return undefined;

    setCountdown(3);

    const countdownTicks = [2, 1, 0];
    const timeoutIds = countdownTicks.map((value, index) =>
      window.setTimeout(() => {
        if (value === 0) {
          setPhase("playing");
          setStartTime(Date.now());
          setElapsedTime(0);
          return;
        }

        setCountdown(value);
      }, (index + 1) * 1000)
    );

    return () => {
      timeoutIds.forEach(timeoutId => window.clearTimeout(timeoutId));
    };
  }, [phase]);

  function handleStart() {
    setQuestions(generateSpeedCheckQuestions());
    setPhase("countdown");
    setCountdown(3);
    setStartTime(0);
    setElapsedTime(0);
    setCurrentQuestionIndex(0);
    setAnswers([]);
    setSelectedAnswer(null);
    setShowFeedback(false);
    setXp(0);
    setShowBubble(false);
    setShakeXpCounter(false);
    setShakePrompt(false);
  }

  function handleRetry() {
    handleStart();
  }

  function handleAnswer(answer: string, event: React.MouseEvent<HTMLButtonElement>) {
    if (phase !== "playing" || showFeedback) return;

    const question = questions[currentQuestionIndex];
    const isCorrect = answer === question.correct;

    setSelectedAnswer(answer);
    setAnswers(current => [...current, isCorrect]);
    setShowFeedback(true);

    if (isCorrect) {
      const gameRect = gameRef.current?.getBoundingClientRect();
      const counterRect = xpCounterRef.current?.getBoundingClientRect();
      const fallbackRect = event.currentTarget.getBoundingClientRect();
      const targetX = (counterRect?.left ?? fallbackRect.left) + (counterRect?.width ?? fallbackRect.width) / 2 - (gameRect?.left ?? 0);
      const targetY = (counterRect?.top ?? fallbackRect.top) + (counterRect?.height ?? fallbackRect.height) / 2 - (gameRect?.top ?? 0);
      const angle = Math.random() * Math.PI * 2;
      const distance = 42 + Math.random() * 26;
      const offsetX = Math.cos(angle) * distance;
      const offsetY = Math.sin(angle) * distance;

      setBubblePosition({
        x: targetX + offsetX,
        y: targetY + offsetY,
        travelX: -offsetX,
        travelY: -offsetY
      });
      setXp(current => current + SPEED_CHECK_XP_PER_CORRECT);
      onXpAwarded?.(SPEED_CHECK_XP_PER_CORRECT);
      setShowBubble(true);
      window.setTimeout(() => {
        setShakeXpCounter(true);
        window.setTimeout(() => setShakeXpCounter(false), 420);
      }, 520);
      window.setTimeout(() => setShowBubble(false), 900);
    } else {
      setShakePrompt(true);
      window.setTimeout(() => setShakePrompt(false), 320);
    }

    window.setTimeout(() => {
      if (currentQuestionIndex >= questions.length - 1) {
        setPhase("results");
        setShowFeedback(false);
        return;
      }

      setCurrentQuestionIndex(index => index + 1);
      setSelectedAnswer(null);
      setShowFeedback(false);
    }, 420);
  }

  const question = questions[currentQuestionIndex];
  const correctCount = answers.filter(Boolean).length;
  const accuracy = answers.length ? Math.round((correctCount / answers.length) * 100) : 0;
  const totalSeconds = Math.round(elapsedTime / 1000);
  const averageSeconds = answers.length ? (totalSeconds / answers.length).toFixed(1) : "0.0";
  const percentile = Math.min(95, Math.max(5, 100 - totalSeconds * 2));

  function getTimerTone() {
    const seconds = elapsedTime / 1000;
    if (seconds < 20) return "cool";
    if (seconds < 30) return "warm";
    if (seconds < 50) return "hot";
    return "danger";
  }

  if (phase === "ready") {
    return (
      <section className="speed-check is-ready" ref={gameRef}>
        <div className="speed-check__hero">
          <div className="speed-check__intro-card">
            <h2>Test your reflexes</h2>
            <p>
              You will see 10 pH values. Classify each one as Normal, Acidaemia, or Alkalaemia as fast as you can.
            </p>
            <ul className="speed-check__rules">
              <li>Each correct answer earns 3 XP.</li>
              <li>The timer stays live while you play.</li>
              <li>Normal pH range is 7.35 to 7.45.</li>
            </ul>
            <button className="figma-button speed-check__start" type="button" onClick={handleStart}>
              Start speed check
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (phase === "results") {
    return (
      <section className="speed-check is-results" ref={gameRef}>
        <div className="speed-check__results">
          <div className="speed-check__result-hero">
            <h2>Great Work!</h2>
            <p>Here is how you performed</p>
          </div>

          <div className="speed-check__stats">
            <article>
              <strong>{correctCount}/{questions.length}</strong>
              <span>Correct answers</span>
            </article>
            <article>
              <strong>{accuracy}%</strong>
              <span>Accuracy</span>
            </article>
            <article>
              <strong>{totalSeconds}s</strong>
              <span>Total time</span>
            </article>
            <article>
              <strong>{averageSeconds}s</strong>
              <span>Avg per question</span>
            </article>
          </div>

          <div className="speed-check__performance">
            You finished faster than {percentile}% of learners!
          </div>

          <div className="speed-check__result-actions">
            <button className="figma-button speed-check__retry" type="button" onClick={handleRetry}>
              Retry
            </button>
            <button className="figma-button speed-check__continue" type="button" onClick={onComplete}>
              Continue
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (phase === "countdown") {
    return (
      <section className="speed-check is-countdown" ref={gameRef}>
        <div className="speed-check__countdown" aria-live="polite">
          <span>Get ready</span>
          <strong>{countdown}</strong>
        </div>
      </section>
    );
  }

  return (
    <section className="speed-check is-playing" ref={gameRef}>
      <div className="speed-check__toolbar">
        <span>Question {currentQuestionIndex + 1} / {questions.length}</span>
        <span className={cn("speed-check__timer", `is-${getTimerTone()}`)}>{(elapsedTime / 1000).toFixed(1)}s</span>
      </div>

      <div className="speed-check__xp-card">
        <div className="dashboard-progress-card__meta speed-check__xp-meta">
          <span>Level {level}</span>
          <strong ref={xpCounterRef} className={cn("speed-check__xp-value", shakeXpCounter && "is-absorbing")}>
            {xpForNextLevel ? `${xpIntoLevel} / ${xpForNextLevel} XP` : xpProgressLabel}
          </strong>
        </div>
        <div className="progress-bar">
          <div
            className="progress-bar__fill progress-bar__fill--animated"
            style={{ width: `${Math.max(0, Math.min(100, xpProgressValue))}%` }}
          />
        </div>
      </div>

      {showBubble ? (
        <div
          className="speed-check__bubble"
          style={{
            top: `${bubblePosition.y}px`,
            left: `${bubblePosition.x}px`,
            "--speed-check-bubble-travel-x": `${bubblePosition.travelX}px`,
            "--speed-check-bubble-travel-y": `${bubblePosition.travelY}px`
          } as CSSProperties & Record<string, string>}
        >
          +3 XP
        </div>
      ) : null}

      <div className={cn("speed-check__question", shakePrompt && "is-shaking")}>
        <span className="speed-check__prompt">What is the pH status?</span>
        <strong>{question.ph}</strong>
        <p>Normal range: 7.35 to 7.45</p>
      </div>

      <div className="speed-check__answers">
        {["Acidaemia", "Normal", "Alkalaemia"].map(answer => {
          const isSelected = selectedAnswer === answer;
          const isCorrect = answer === question.correct;
          const feedbackState = showFeedback && isSelected
            ? isCorrect ? "correct" : "incorrect"
            : "idle";

          return (
            <button
              key={answer}
              className={cn(
                "speed-check__answer",
                feedbackState === "correct" && "is-correct",
                feedbackState === "incorrect" && "is-incorrect"
              )}
              type="button"
              onClick={event => handleAnswer(answer, event)}
              disabled={showFeedback}
            >
              <span>{answer}</span>
              {feedbackState === "correct" ? <strong>✓</strong> : null}
              {feedbackState === "incorrect" ? <strong>X</strong> : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}
