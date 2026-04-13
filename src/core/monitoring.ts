import * as Sentry from "@sentry/react";

function parseSampleRate(value: string | undefined, fallback = 0): number {
  if (!value) return fallback;

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    return fallback;
  }

  return parsed;
}

export function initMonitoring() {
  const dsn = import.meta.env.VITE_SENTRY_DSN?.trim();
  if (!dsn) return;

  const tracesSampleRate = parseSampleRate(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE, 0);
  const replaySessionSampleRate = parseSampleRate(import.meta.env.VITE_SENTRY_REPLAY_SESSION_SAMPLE_RATE, 0);
  const replayOnErrorSampleRate = parseSampleRate(import.meta.env.VITE_SENTRY_REPLAY_ON_ERROR_SAMPLE_RATE, 0);
  const integrations = [];

  if (tracesSampleRate > 0) {
    integrations.push(Sentry.browserTracingIntegration());
  }

  if (replaySessionSampleRate > 0 || replayOnErrorSampleRate > 0) {
    integrations.push(Sentry.replayIntegration());
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT?.trim() || undefined,
    release: typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : undefined,
    sendDefaultPii: false,
    integrations,
    tracesSampleRate,
    replaysSessionSampleRate: replaySessionSampleRate,
    replaysOnErrorSampleRate: replayOnErrorSampleRate
  });
}
