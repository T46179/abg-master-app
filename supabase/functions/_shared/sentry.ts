import * as Sentry from "npm:@sentry/deno@10.10.0";

let initializedDsn: string | null = null;

function parseSampleRate(value: string | undefined, fallback = 0): number {
  if (!value) return fallback;

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    return fallback;
  }

  return parsed;
}

export function initFunctionMonitoring(functionName: string): boolean {
  const dsn = (Deno.env.get("SENTRY_DSN") ?? "").trim();
  if (!dsn) return false;

  if (initializedDsn !== dsn) {
    Sentry.init({
      dsn,
      environment: (Deno.env.get("SENTRY_ENVIRONMENT") ?? "").trim() || undefined,
      release: (Deno.env.get("SENTRY_RELEASE") ?? "").trim() || undefined,
      sendDefaultPii: false,
      defaultIntegrations: false,
      tracesSampleRate: parseSampleRate(Deno.env.get("SENTRY_TRACES_SAMPLE_RATE") ?? undefined, 0),
      profilesSampleRate: parseSampleRate(Deno.env.get("SENTRY_PROFILES_SAMPLE_RATE") ?? undefined, 0)
    });
    initializedDsn = dsn;
  }

  Sentry.setTag("function_name", functionName);
  return true;
}

export async function captureFunctionException(
  functionName: string,
  error: unknown,
  request?: Request,
  extras: Record<string, unknown> = {}
) {
  if (!initFunctionMonitoring(functionName)) return;

  Sentry.withScope(scope => {
    scope.setTag("function_name", functionName);

    const region = (Deno.env.get("SB_REGION") ?? "").trim();
    if (region) {
      scope.setTag("region", region);
    }

    const executionId = (Deno.env.get("SB_EXECUTION_ID") ?? "").trim();
    if (executionId) {
      scope.setTag("execution_id", executionId);
    }

    if (request) {
      scope.setContext("request", {
        method: request.method,
        url: request.url
      });
    }

    for (const [key, value] of Object.entries(extras)) {
      if (typeof value !== "undefined") {
        scope.setExtra(key, value);
      }
    }

    Sentry.captureException(error);
  });

  await Sentry.flush(2000);
}
