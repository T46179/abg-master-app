import { useEffect, useRef, useState, type CSSProperties } from "react";
import timerIcon from "../../../assets/icons/timer.svg";
import { cn } from "../../utils";
import {
  BLOOD_GAS_BLITZ_ADVANCE_DELAY_MS,
  BLOOD_GAS_BLITZ_CORRECT_FEEDBACK,
  BLOOD_GAS_BLITZ_FINAL_REVEAL_DELAY_MS,
  BLOOD_GAS_BLITZ_INCORRECT_FEEDBACK,
  BLOOD_GAS_BLITZ_XP_PER_CORRECT,
  getPlayableBloodGasBlitzConfig
} from "./bloodGasBlitzConfig";
import { generateBloodGasBlitzQuestions } from "./bloodGasBlitzQuestionGenerator";
import { getBloodGasBlitzPreset, type BloodGasBlitzPresetId } from "./bloodGasBlitzPresets";
import {
  BLOOD_GAS_BLITZ_GAME_ID,
  type BloodGasBlitzAnswerAttempt,
  type BloodGasBlitzAnswerLabel,
  type BloodGasBlitzAttemptResult,
  type BloodGasBlitzPhase,
  type BloodGasBlitzPlacement,
  type BloodGasBlitzPlayableVersionId,
  type BloodGasBlitzQuestion
} from "./bloodGasBlitzTypes";

export interface BloodGasBlitzGameProps {
  onComplete: () => void;
  onPhaseChange?: (phase: BloodGasBlitzPhase) => void;
  onResult?: (result: BloodGasBlitzAttemptResult) => void;
  onXpAwarded?: (amount: number) => void;
  placement?: BloodGasBlitzPlacement;
  preset?: BloodGasBlitzPresetId;
  resetKey?: number;
  versionId?: BloodGasBlitzPlayableVersionId;
  level?: number;
  xpForNextLevel?: number;
  xpIntoLevel?: number;
  xpProgressLabel?: string;
  xpProgressValue?: number;
}

type StreakPillTone = "active" | "broken";
type StreakPillAnimation = "pulse" | "fizzle" | null;

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

function getMaxStreak(answers: BloodGasBlitzAnswerAttempt[]) {
  let current = 0;
  let max = 0;

  answers.forEach(answer => {
    current = answer.isCorrect ? current + 1 : 0;
    max = Math.max(max, current);
  });

  return max;
}

export function BloodGasBlitzGame({
  level = 1,
  onComplete,
  onPhaseChange,
  onResult,
  onXpAwarded,
  placement,
  preset = "learn-foundations",
  resetKey = 0,
  versionId = "ph-classification-v1",
  xpForNextLevel = 0,
  xpIntoLevel = 0,
  xpProgressLabel = "0 / 0 XP",
  xpProgressValue = 0
}: BloodGasBlitzGameProps) {
  const config = getPlayableBloodGasBlitzConfig(versionId);
  const presetConfig = getBloodGasBlitzPreset(preset);
  const resultPlacement = placement ?? presetConfig.placement;
  const shouldShowXp = presetConfig.showXp;
  const shouldAwardXp = presetConfig.awardXp;
  const gameRef = useRef<HTMLElement | null>(null);
  const xpCounterRef = useRef<HTMLElement | null>(null);
  const pendingTimeoutsRef = useRef<number[]>([]);
  const streakHideTimeoutRef = useRef<number | null>(null);
  const streakAnimationTimeoutRef = useRef<number | null>(null);
  const streakAnimationKickoffTimeoutRef = useRef<number | null>(null);
  const correctFeedbackIndexRef = useRef(0);
  const incorrectFeedbackIndexRef = useRef(0);
  const [phase, setPhase] = useState<BloodGasBlitzPhase>("ready");
  const [questions, setQuestions] = useState<BloodGasBlitzQuestion[]>(() => generateBloodGasBlitzQuestions(versionId));
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<BloodGasBlitzAnswerAttempt[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<BloodGasBlitzAnswerLabel | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [startTime, setStartTime] = useState(0);
  const [startedAt, setStartedAt] = useState("");
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showBubble, setShowBubble] = useState(false);
  const [bubbleLabel, setBubbleLabel] = useState(`+${BLOOD_GAS_BLITZ_XP_PER_CORRECT} XP`);
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
  const [feedbackDurationMs, setFeedbackDurationMs] = useState(BLOOD_GAS_BLITZ_ADVANCE_DELAY_MS);

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
    setBubbleLabel(`+${BLOOD_GAS_BLITZ_XP_PER_CORRECT} XP`);
    setShakeXpCounter(false);
    setShakePrompt(false);
    setCurrentStreak(0);
    setStreakPillLabel("");
    setStreakPillTone("active");
    setStreakPillAnimation(null);
    setFeedbackCopy("");
    setFeedbackTone(null);
    setFeedbackDurationMs(BLOOD_GAS_BLITZ_ADVANCE_DELAY_MS);
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

    const message = BLOOD_GAS_BLITZ_CORRECT_FEEDBACK[correctFeedbackIndexRef.current % BLOOD_GAS_BLITZ_CORRECT_FEEDBACK.length];
    correctFeedbackIndexRef.current += 1;
    return message;
  }

  function getNextIncorrectFeedback(hadVisibleStreak: boolean) {
    if (hadVisibleStreak) return "Streak broken";

    const message = BLOOD_GAS_BLITZ_INCORRECT_FEEDBACK[incorrectFeedbackIndexRef.current % BLOOD_GAS_BLITZ_INCORRECT_FEEDBACK.length];
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
    setQuestions(generateBloodGasBlitzQuestions(versionId));
    setCurrentQuestionIndex(0);
    setAnswers([]);
    setSelectedAnswer(null);
    setShowFeedback(false);
    setStartTime(0);
    setStartedAt("");
    setElapsedTime(0);
    setCountdown(3);
    resetTransientState();
  }, [resetKey, versionId]);

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
          setStartedAt(new Date().toISOString());
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
    setQuestions(generateBloodGasBlitzQuestions(versionId));
    setPhase("countdown");
    setCountdown(3);
    setStartTime(0);
    setStartedAt("");
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

  function handleAnswer(answer: BloodGasBlitzAnswerLabel, event: React.MouseEvent<HTMLButtonElement>) {
    if (phase !== "playing" || showFeedback) return;

    const question = questions[currentQuestionIndex];
    const isCorrect = answer === question.expectedAnswer;
    const answeredAtMs = Date.now() - startTime;
    const answerAttempt: BloodGasBlitzAnswerAttempt = {
      questionId: question.id,
      questionIndex: currentQuestionIndex,
      value: question.value,
      expectedAnswer: question.expectedAnswer,
      selectedAnswer: answer,
      isCorrect,
      answeredAtMs
    };
    const nextAnswers = [...answers, answerAttempt];
    const nextStreak = isCorrect ? currentStreak + 1 : 0;
    const streakBonus = isCorrect ? getStreakBonus(nextStreak) : 0;
    const awardedXp = BLOOD_GAS_BLITZ_XP_PER_CORRECT + streakBonus;
    const isFinalQuestion = currentQuestionIndex >= questions.length - 1;
    const transitionDelay = isFinalQuestion ? BLOOD_GAS_BLITZ_FINAL_REVEAL_DELAY_MS : BLOOD_GAS_BLITZ_ADVANCE_DELAY_MS;
    const nextFeedbackCopy = isCorrect
      ? getNextCorrectFeedback(nextStreak)
      : getNextIncorrectFeedback(currentStreak >= 2);

    setSelectedAnswer(answer);
    setAnswers(nextAnswers);
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
      if (shouldAwardXp) onXpAwarded?.(awardedXp);
      if (shouldShowXp) setShowBubble(true);
      setCurrentStreak(nextStreak);

      if (nextStreak >= 2) {
        setStreakPillTone("active");
        setStreakPillLabel(getStreakLabel(nextStreak));
        triggerStreakAnimation("pulse");
      } else {
        setStreakPillLabel("");
        setStreakPillAnimation(null);
      }

      if (shouldShowXp) {
        scheduleTimeout(() => {
          setShakeXpCounter(true);
          scheduleTimeout(() => setShakeXpCounter(false), 420);
        }, 520);
        scheduleTimeout(() => setShowBubble(false), 900);
      }
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

        const correctAnswerCount = nextAnswers.filter(item => item.isCorrect).length;
        const completedAt = new Date().toISOString();

        onResult?.({
          gameId: BLOOD_GAS_BLITZ_GAME_ID,
          versionId,
          placement: resultPlacement,
          startedAt,
          completedAt,
          correctCount: correctAnswerCount,
          totalQuestions: questions.length,
          elapsedMs: finalElapsedMs,
          accuracy: questions.length ? Math.round((correctAnswerCount / questions.length) * 100) : 0,
          averageMsPerQuestion: questions.length ? Math.round(finalElapsedMs / questions.length) : 0,
          maxStreak: getMaxStreak(nextAnswers),
          answers: nextAnswers
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
  const correctCount = answers.filter(answer => answer.isCorrect).length;
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
      <section className={cn("speed-check is-ready", `speed-check--${preset}`)} ref={gameRef}>
        <div className="speed-check__hero">
          <div className="speed-check__intro-card">
            <h2>Test your reflexes</h2>
            <p>
              {preset === "onboarding-calibration"
                ? "Classify the 10 pH values as fast as you can. Speed and accuracy matter."
                : "Classify the pH values as fast as you can"}
            </p>
            {preset === "learn-foundations" ? (
              <ul className="speed-check__rules">
                <li>Earn bonus XP with streaks</li>
                <li>Accuracy matters</li>
              </ul>
            ) : null}
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
      <section className={cn("speed-check is-results", `speed-check--${preset}`)} ref={gameRef}>
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
            {preset === "learn-foundations" ? (
              <button className="figma-button speed-check__retry" type="button" onClick={handleRetry}>
                Retry
              </button>
            ) : null}
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
      <section className={cn("speed-check is-countdown", `speed-check--${preset}`)} ref={gameRef}>
        <div className="speed-check__countdown" aria-live="polite">
          <span>Get ready</span>
          <strong>{countdown}</strong>
        </div>
      </section>
    );
  }

  return (
    <section className={cn("speed-check is-playing", `speed-check--${preset}`)} ref={gameRef}>
      {shouldShowXp ? (
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
      ) : null}

      {shouldShowXp && showBubble ? (
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
                    dotState = answers[index].isCorrect ? "correct" : "incorrect";
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

        <span className="speed-check__prompt">{config.prompt}</span>
        <strong>{question.value}</strong>
        <p>{config.rangeLabel}</p>
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
        {config.answers.map(answer => {
          const isSelected = selectedAnswer === answer;
          const isCorrect = answer === question.expectedAnswer;
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
