import { useEffect, useRef, useState, type CSSProperties } from "react";
import timerIcon from "../../assets/icons/timer.svg";
import { cn } from "../utils";

export type SpeedCheckPhase = "ready" | "countdown" | "playing" | "results";

interface SpeedCheckGameProps {
  onComplete: () => void;
  onPhaseChange?: (phase: SpeedCheckPhase) => void;
  onResult?: (result: { correctCount: number; totalQuestions: number; elapsedMs: number }) => void;
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

type StreakPillTone = "active" | "broken";
type StreakPillAnimation = "pulse" | "fizzle" | null;

const SPEED_CHECK_QUESTION_COUNT = 10;
const SPEED_CHECK_XP_PER_CORRECT = 3;
const SPEED_CHECK_ADVANCE_DELAY_MS = 560;
const SPEED_CHECK_FINAL_REVEAL_DELAY_MS = 960;
const SPEED_CHECK_CORRECT_FEEDBACK = ["Correct", "Nice!", "Clean read", "Quick call!"] as const;
const SPEED_CHECK_INCORRECT_FEEDBACK = ["Not quite", "Reset and try again"] as const;

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

const SPEED_CHECK_ANSWERS: SpeedCheckQuestion["correct"][] = [
  "Acidaemia",
  "Normal",
  "Alkalaemia"
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

function getStreakBonus(streak: number) {
  if (streak >= 10) return 5;
  if (streak >= 5) return 2;
  if (streak >= 3) return 1;
  return 0;
}

function getStreakLabel(streak: number) {
  if (streak >= 10) return "\u{1F9E0} Perfect run";
  if (streak >= 5) return `\u26A1 Hot streak x${streak}`;
  if (streak >= 3) return `\u{1F525} Streak x${streak}`;
  if (streak === 2) return "Nice rhythm";
  return "";
}

function getMilestoneFeedback(streak: number) {
  if (streak >= 10) return "Perfect run!";
  if (streak >= 5) return "Hot streak!";
  if (streak === 4) return "You're warming up";
  if (streak === 3) return "3 in a row!";
  return "";
}

export function SpeedCheckGame({
  level = 1,
  onComplete,
  onPhaseChange,
  onResult,
  onXpAwarded,
  resetKey = 0,
  xpForNextLevel = 0,
  xpIntoLevel = 0,
  xpProgressLabel = "0 / 0 XP",
  xpProgressValue = 0
}: SpeedCheckGameProps) {
  const gameRef = useRef<HTMLElement | null>(null);
  const xpCounterRef = useRef<HTMLElement | null>(null);
  const pendingTimeoutsRef = useRef<number[]>([]);
  const streakHideTimeoutRef = useRef<number | null>(null);
  const streakAnimationTimeoutRef = useRef<number | null>(null);
  const streakAnimationKickoffTimeoutRef = useRef<number | null>(null);
  const correctFeedbackIndexRef = useRef(0);
  const incorrectFeedbackIndexRef = useRef(0);
  const [phase, setPhase] = useState<SpeedCheckPhase>("ready");
  const [questions, setQuestions] = useState<SpeedCheckQuestion[]>(() => generateSpeedCheckQuestions());
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<boolean[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<SpeedCheckQuestion["correct"] | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [startTime, setStartTime] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showBubble, setShowBubble] = useState(false);
  const [bubbleLabel, setBubbleLabel] = useState(`+${SPEED_CHECK_XP_PER_CORRECT} XP`);
  const [shakeXpCounter, setShakeXpCounter] = useState(false);
  const [shakePrompt, setShakePrompt] = useState(false);
  const [bubblePosition, setBubblePosition] = useState({ x: 0, y: 0, travelX: 0, travelY: 0 });
  const [countdown, setCountdown] = useState(3);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [streakPillLabel, setStreakPillLabel] = useState("");
  const [streakPillTone, setStreakPillTone] = useState<StreakPillTone>("active");
  const [streakPillAnimation, setStreakPillAnimation] = useState<StreakPillAnimation>(null);
  const [feedbackCopy, setFeedbackCopy] = useState("");
  const [feedbackTone, setFeedbackTone] = useState<"correct" | "incorrect" | null>(null);
  const [feedbackDurationMs, setFeedbackDurationMs] = useState(SPEED_CHECK_ADVANCE_DELAY_MS);

  function clearPendingTimeouts() {
    pendingTimeoutsRef.current.forEach(timeoutId => window.clearTimeout(timeoutId));
    pendingTimeoutsRef.current = [];
  }

  function scheduleTimeout(callback: () => void, delay: number) {
    const timeoutId = window.setTimeout(() => {
      pendingTimeoutsRef.current = pendingTimeoutsRef.current.filter(id => id !== timeoutId);
      callback();
    }, delay);

    pendingTimeoutsRef.current.push(timeoutId);
    return timeoutId;
  }

  function clearStreakTimers() {
    if (streakHideTimeoutRef.current !== null) {
      window.clearTimeout(streakHideTimeoutRef.current);
      streakHideTimeoutRef.current = null;
    }

    if (streakAnimationTimeoutRef.current !== null) {
      window.clearTimeout(streakAnimationTimeoutRef.current);
      streakAnimationTimeoutRef.current = null;
    }

    if (streakAnimationKickoffTimeoutRef.current !== null) {
      window.clearTimeout(streakAnimationKickoffTimeoutRef.current);
      streakAnimationKickoffTimeoutRef.current = null;
    }
  }

  function resetTransientState() {
    clearPendingTimeouts();
    clearStreakTimers();
    setShowBubble(false);
    setBubbleLabel(`+${SPEED_CHECK_XP_PER_CORRECT} XP`);
    setShakeXpCounter(false);
    setShakePrompt(false);
    setCurrentStreak(0);
    setStreakPillLabel("");
    setStreakPillTone("active");
    setStreakPillAnimation(null);
    setFeedbackCopy("");
    setFeedbackTone(null);
    setFeedbackDurationMs(SPEED_CHECK_ADVANCE_DELAY_MS);
    correctFeedbackIndexRef.current = 0;
    incorrectFeedbackIndexRef.current = 0;
  }

  function triggerStreakAnimation(animation: Exclude<StreakPillAnimation, null>) {
    if (streakAnimationTimeoutRef.current !== null) {
      window.clearTimeout(streakAnimationTimeoutRef.current);
    }

    if (streakAnimationKickoffTimeoutRef.current !== null) {
      window.clearTimeout(streakAnimationKickoffTimeoutRef.current);
    }

    setStreakPillAnimation(null);
    streakAnimationKickoffTimeoutRef.current = window.setTimeout(() => {
      setStreakPillAnimation(animation);
      streakAnimationKickoffTimeoutRef.current = null;
    }, 0);

    streakAnimationTimeoutRef.current = window.setTimeout(() => {
      setStreakPillAnimation(null);
      streakAnimationTimeoutRef.current = null;
    }, animation === "pulse" ? 420 : 520);
  }

  function showBrokenStreakPill(label: string) {
    setStreakPillTone("broken");
    setStreakPillLabel(label);
    triggerStreakAnimation("fizzle");

    if (streakHideTimeoutRef.current !== null) {
      window.clearTimeout(streakHideTimeoutRef.current);
    }

    streakHideTimeoutRef.current = window.setTimeout(() => {
      setStreakPillLabel("");
      setStreakPillAnimation(null);
      streakHideTimeoutRef.current = null;
    }, 900);
  }

  function getNextCorrectFeedback(streak: number) {
    const milestoneFeedback = getMilestoneFeedback(streak);
    if (milestoneFeedback) return milestoneFeedback;

    const message = SPEED_CHECK_CORRECT_FEEDBACK[correctFeedbackIndexRef.current % SPEED_CHECK_CORRECT_FEEDBACK.length];
    correctFeedbackIndexRef.current += 1;
    return message;
  }

  function getNextIncorrectFeedback(hadVisibleStreak: boolean) {
    if (hadVisibleStreak) return "Streak broken";

    const message = SPEED_CHECK_INCORRECT_FEEDBACK[incorrectFeedbackIndexRef.current % SPEED_CHECK_INCORRECT_FEEDBACK.length];
    incorrectFeedbackIndexRef.current += 1;
    return message;
  }

  useEffect(() => {
    onPhaseChange?.(phase);
  }, [onPhaseChange, phase]);

  useEffect(() => () => {
    clearPendingTimeouts();
    clearStreakTimers();
  }, []);

  useEffect(() => {
    setPhase("ready");
    setCurrentQuestionIndex(0);
    setAnswers([]);
    setSelectedAnswer(null);
    setShowFeedback(false);
    setStartTime(0);
    setElapsedTime(0);
    setCountdown(3);
    resetTransientState();
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
    resetTransientState();
  }

  function handleRetry() {
    handleStart();
  }

  function handleAnswer(answer: SpeedCheckQuestion["correct"], event: React.MouseEvent<HTMLButtonElement>) {
    if (phase !== "playing" || showFeedback) return;

    const question = questions[currentQuestionIndex];
    const isCorrect = answer === question.correct;
    const nextStreak = isCorrect ? currentStreak + 1 : 0;
    const streakBonus = isCorrect ? getStreakBonus(nextStreak) : 0;
    const awardedXp = SPEED_CHECK_XP_PER_CORRECT + streakBonus;
    const isFinalQuestion = currentQuestionIndex >= questions.length - 1;
    const transitionDelay = isFinalQuestion ? SPEED_CHECK_FINAL_REVEAL_DELAY_MS : SPEED_CHECK_ADVANCE_DELAY_MS;
    const nextFeedbackCopy = isCorrect
      ? getNextCorrectFeedback(nextStreak)
      : getNextIncorrectFeedback(currentStreak >= 2);

    setSelectedAnswer(answer);
    setAnswers(current => [...current, isCorrect]);
    setShowFeedback(true);
    setFeedbackTone(isCorrect ? "correct" : "incorrect");
    setFeedbackCopy(nextFeedbackCopy);
    setFeedbackDurationMs(transitionDelay);

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
      setBubbleLabel(streakBonus > 0 ? `+${awardedXp} XP - streak bonus` : `+${awardedXp} XP`);
      onXpAwarded?.(awardedXp);
      setShowBubble(true);
      setCurrentStreak(nextStreak);

      if (nextStreak >= 2) {
        setStreakPillTone("active");
        setStreakPillLabel(getStreakLabel(nextStreak));
        triggerStreakAnimation("pulse");
      } else {
        setStreakPillLabel("");
        setStreakPillAnimation(null);
      }

      scheduleTimeout(() => {
        setShakeXpCounter(true);
        scheduleTimeout(() => setShakeXpCounter(false), 420);
      }, 520);
      scheduleTimeout(() => setShowBubble(false), 900);
    } else {
      if (currentStreak >= 2) {
        showBrokenStreakPill("Streak broken");
      } else {
        setStreakPillLabel("");
        setStreakPillAnimation(null);
      }

      setCurrentStreak(0);
      setShakePrompt(true);
      scheduleTimeout(() => setShakePrompt(false), 320);
    }

    scheduleTimeout(() => {
      if (isFinalQuestion) {
        const finalElapsedMs = Date.now() - startTime;

        onResult?.({
          correctCount: answers.filter(Boolean).length + (isCorrect ? 1 : 0),
          totalQuestions: questions.length,
          elapsedMs: finalElapsedMs
        });
        setElapsedTime(finalElapsedMs);
        setPhase("results");
        setShowFeedback(false);
        setFeedbackCopy("");
        setFeedbackTone(null);
        return;
      }

      setCurrentQuestionIndex(index => index + 1);
      setSelectedAnswer(null);
      setShowFeedback(false);
      setFeedbackCopy("");
      setFeedbackTone(null);
    }, transitionDelay);
  }

  const question = questions[currentQuestionIndex];
  const correctCount = answers.filter(Boolean).length;
  const accuracy = answers.length ? Math.round((correctCount / answers.length) * 100) : 0;
  const totalSeconds = (elapsedTime / 1000).toFixed(1);
  const averageSeconds = questions.length ? (elapsedTime / 1000 / questions.length).toFixed(1) : "0.0";

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
              Classify the pH values as fast as you can
            </p>
            <ul className="speed-check__rules">
              <li>Earn bonus XP with streaks</li>
              <li>Accuracy matters</li>
            </ul>
            <button className="figma-button speed-check__start" type="button" onClick={handleStart}>
              Begin
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
            <h2>{correctCount === questions.length ? "Perfect!" : "Great Work!"}</h2>
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
          {bubbleLabel}
        </div>
      ) : null}

      <div className={cn("speed-check__question", shakePrompt && "is-shaking")}>
        <div className="speed-check__question-topbar">
          <div className="speed-check__progress-dots" aria-label="Question progress">
            {questions.map((_, index) => {
              let dotState = "upcoming";

              if (index < answers.length) {
                dotState = answers[index] ? "correct" : "incorrect";
              } else if (index === currentQuestionIndex) {
                dotState = "current";
              }

              return (
                <span
                  key={`speed-check-dot-${index}`}
                  className={cn("speed-check__progress-dot", `is-${dotState}`)}
                  aria-hidden="true"
                />
              );
            })}
          </div>

          <div className="speed-check__status-pills">
            {streakPillLabel ? (
              <div
                className={cn(
                  "speed-check__streak-pill",
                  `is-${streakPillTone}`,
                  streakPillAnimation && `is-${streakPillAnimation}`
                )}
              >
                <span>{streakPillLabel}</span>
              </div>
            ) : null}

            <div className={cn("speed-check__timer", `is-${getTimerTone()}`)}>
              <img src={timerIcon} alt="" aria-hidden="true" />
              <span className="speed-check__timer-value">{(elapsedTime / 1000).toFixed(1)}s</span>
            </div>
          </div>
        </div>

        <span className="speed-check__prompt">Classify the pH</span>
        <strong>{question.ph}</strong>
        <p>Normal range: 7.35 to 7.45</p>
        <div
          className={cn(
            "speed-check__feedback-copy",
            feedbackTone && `is-${feedbackTone}`,
            showFeedback && "is-visible"
          )}
          style={{ "--speed-check-feedback-duration": `${feedbackDurationMs}ms` } as CSSProperties & Record<string, string>}
          aria-live="polite"
        >
          {feedbackCopy}
        </div>
      </div>

      <div className="speed-check__answers">
        {SPEED_CHECK_ANSWERS.map(answer => {
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
            </button>
          );
        })}
      </div>
    </section>
  );
}
