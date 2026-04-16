import { useEffect, useState } from "react";
import { Zap } from "lucide-react";
import { cn } from "../utils";

export type SpeedCheckPhase = "ready" | "playing" | "results";

interface SpeedCheckGameProps {
  onComplete: () => void;
  onPhaseChange?: (phase: SpeedCheckPhase) => void;
}

interface SpeedCheckQuestion {
  ph: number;
  correct: "Normal" | "Acidaemia" | "Alkalaemia";
}

export const SPEED_CHECK_QUESTIONS: SpeedCheckQuestion[] = [
  { ph: 7.28, correct: "Acidaemia" },
  { ph: 7.42, correct: "Normal" },
  { ph: 7.51, correct: "Alkalaemia" },
  { ph: 7.22, correct: "Acidaemia" },
  { ph: 7.38, correct: "Normal" },
  { ph: 7.48, correct: "Alkalaemia" },
  { ph: 7.15, correct: "Acidaemia" },
  { ph: 7.44, correct: "Normal" },
  { ph: 7.53, correct: "Alkalaemia" },
  { ph: 7.35, correct: "Normal" }
];

export function SpeedCheckGame({ onComplete, onPhaseChange }: SpeedCheckGameProps) {
  const [phase, setPhase] = useState<SpeedCheckPhase>("ready");
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<boolean[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [startTime, setStartTime] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [xp, setXp] = useState(0);
  const [showBubble, setShowBubble] = useState(false);
  const [shakePrompt, setShakePrompt] = useState(false);
  const [bubblePosition, setBubblePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    onPhaseChange?.(phase);
  }, [onPhaseChange, phase]);

  useEffect(() => {
    if (phase !== "playing") return undefined;

    const intervalId = window.setInterval(() => {
      setElapsedTime(Date.now() - startTime);
    }, 100);

    return () => window.clearInterval(intervalId);
  }, [phase, startTime]);

  function handleStart() {
    setPhase("playing");
    setStartTime(Date.now());
    setElapsedTime(0);
    setCurrentQuestionIndex(0);
    setAnswers([]);
    setSelectedAnswer(null);
    setShowFeedback(false);
    setXp(0);
    setShowBubble(false);
    setShakePrompt(false);
  }

  function handleAnswer(answer: string, event: React.MouseEvent<HTMLButtonElement>) {
    if (phase !== "playing" || showFeedback) return;

    const question = SPEED_CHECK_QUESTIONS[currentQuestionIndex];
    const isCorrect = answer === question.correct;

    setSelectedAnswer(answer);
    setAnswers(current => [...current, isCorrect]);
    setShowFeedback(true);

    if (isCorrect) {
      const rect = event.currentTarget.getBoundingClientRect();
      setBubblePosition({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      });
      setXp(current => current + 20);
      setShowBubble(true);
      window.setTimeout(() => setShowBubble(false), 900);
    } else {
      setShakePrompt(true);
      window.setTimeout(() => setShakePrompt(false), 320);
    }

    window.setTimeout(() => {
      if (currentQuestionIndex >= SPEED_CHECK_QUESTIONS.length - 1) {
        setPhase("results");
        setShowFeedback(false);
        return;
      }

      setCurrentQuestionIndex(index => index + 1);
      setSelectedAnswer(null);
      setShowFeedback(false);
    }, 420);
  }

  const question = SPEED_CHECK_QUESTIONS[currentQuestionIndex];
  const correctCount = answers.filter(Boolean).length;
  const accuracy = answers.length ? Math.round((correctCount / answers.length) * 100) : 0;
  const totalSeconds = Math.round(elapsedTime / 1000);
  const averageSeconds = answers.length ? (totalSeconds / answers.length).toFixed(1) : "0.0";
  const xpPercentage = Math.min(100, (xp / (SPEED_CHECK_QUESTIONS.length * 20)) * 100);
  const percentile = Math.min(95, Math.max(5, 100 - totalSeconds * 2));

  function getTimerTone() {
    const seconds = elapsedTime / 1000;
    if (seconds < 20) return "cool";
    if (seconds < 35) return "warm";
    if (seconds < 50) return "hot";
    return "danger";
  }

  if (phase === "ready") {
    return (
      <section className="speed-check">
        <div className="speed-check__hero">
          <div className="speed-check__icon">
            <Zap />
          </div>
          <h2>Ready for a speed check?</h2>
          <p>
            You will see 10 pH values. Classify each one as Normal, Acidaemia, or Alkalaemia as fast as you can.
          </p>
          <ul className="speed-check__rules">
            <li>Each correct answer earns 20 XP.</li>
            <li>The timer stays live while you play.</li>
            <li>Normal pH range is 7.35 to 7.45.</li>
          </ul>
          <button className="figma-button speed-check__start" type="button" onClick={handleStart}>
            Start speed check
          </button>
        </div>
      </section>
    );
  }

  if (phase === "results") {
    return (
      <section className="speed-check">
        <div className="speed-check__results">
          <div className="speed-check__result-hero">
            <div className="speed-check__result-badge">Complete</div>
            <h2>Speed check complete</h2>
            <p>Great work. Here is how you performed.</p>
          </div>

          <div className="speed-check__stats">
            <article>
              <strong>{correctCount}/{SPEED_CHECK_QUESTIONS.length}</strong>
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

          <div className="speed-check__xp-card">
            <div className="speed-check__xp-copy">
              <span>XP earned</span>
              <strong>{xp} / 200 XP</strong>
            </div>
            <div className="speed-check__xp-track">
              <div className="speed-check__xp-fill" style={{ width: `${xpPercentage}%` }} />
            </div>
          </div>

          <div className="speed-check__performance">
            You finished faster than {percentile}% of learners in this drill.
          </div>

          <button className="figma-button speed-check__continue" type="button" onClick={onComplete}>
            Continue learning
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="speed-check">
      <div className="speed-check__toolbar">
        <span>Question {currentQuestionIndex + 1} / {SPEED_CHECK_QUESTIONS.length}</span>
        <span className={cn("speed-check__timer", `is-${getTimerTone()}`)}>{(elapsedTime / 1000).toFixed(1)}s</span>
      </div>

      <div className="speed-check__xp-card">
        <div className="speed-check__xp-copy">
          <span>XP progress</span>
          <strong>{xp} / 200 XP</strong>
        </div>
        <div className="speed-check__xp-track">
          <div className="speed-check__xp-fill" style={{ width: `${xpPercentage}%` }} />
        </div>
      </div>

      {showBubble ? (
        <div
          className="speed-check__bubble"
          style={{
            top: `${bubblePosition.y}px`,
            left: `${bubblePosition.x}px`
          }}
        >
          +20 XP
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
              {feedbackState === "correct" ? <strong>OK</strong> : null}
              {feedbackState === "incorrect" ? <strong>X</strong> : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}
