export const PROTECTED_PRACTICE_MESSAGES = {
  unavailableOffline: "You're offline right now. Reconnect to load a new case.",
  unavailableGeneric: "We can't load a new case right now. Please try again.",
  unavailableNotReady: "New cases aren't ready to load right now. Please try again in a moment.",
  refreshFailed: "We couldn't refresh new cases right now.",
  caseMismatch: "We couldn't load that case. Please try again.",
  answerAllSteps: "Please answer every question before finishing the case.",
  interactionLocked: "We're finishing your last case. This screen is locked for a moment.",
  retryBanner: "We're finishing your last case.",
  retrying: "We're still saving your last case.",
  savedUntilOnline: "Your answers are saved. We'll finish when you're back online.",
  savedCaseExpired: "Your last case is no longer available. Please start a new case.",
  savedCaseOutOfDate: "Your saved answers no longer match this case. Please start a new case.",
  caseExpiredBeforeCheck: "This case is no longer available. Please start a new case."
} as const;

export function getProtectedPracticeUnavailableMessage() {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return PROTECTED_PRACTICE_MESSAGES.unavailableOffline;
  }

  return PROTECTED_PRACTICE_MESSAGES.unavailableGeneric;
}
