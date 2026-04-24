import type { CasesPayload, RuntimeConfig } from "./types";

interface RuntimeStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const RUNTIME_BOOTSTRAP_CACHE_KEY = "abgmaster_runtimeBootstrap";
const RUNTIME_BOOTSTRAP_USER_MESSAGE =
  "We could not load the app data needed to start ABG Master. Please check your connection and refresh.";

export class RuntimeBootstrapError extends Error {
  readonly userMessage = RUNTIME_BOOTSTRAP_USER_MESSAGE;

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "RuntimeBootstrapError";
  }
}

export function isRuntimeBootstrapError(error: unknown): error is RuntimeBootstrapError {
  return error instanceof RuntimeBootstrapError;
}

export function getRuntimeBootstrapUserMessage() {
  return RUNTIME_BOOTSTRAP_USER_MESSAGE;
}

function normalizeBaseUrl(baseUrl: string) {
  if (!baseUrl) return "/";
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}

export function getRuntimeAssetPath(assetName: string, baseUrl = import.meta.env.BASE_URL): string {
  const normalizedAssetName = assetName.replace(/^\/+/, "");
  return `${normalizeBaseUrl(baseUrl)}${normalizedAssetName}`;
}

export async function loadRuntimeConfig(doc: Document = document): Promise<RuntimeConfig> {
  void doc;

  return {
    SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY
  };
}

export function normalizeCasesPayload(payload: unknown): CasesPayload {
  if (
    payload &&
    typeof payload === "object" &&
    !Array.isArray(payload) &&
    String((payload as { delivery_mode?: unknown }).delivery_mode ?? "") === "protected_runtime"
  ) {
    const typedPayload = payload as {
      progression_config?: CasesPayload["progressionConfig"];
      default_user_state?: CasesPayload["defaultUserState"];
      dashboard_state?: CasesPayload["dashboardState"];
      content_version?: string | null;
    };

    return {
      cases: [],
      progressionConfig: typedPayload.progression_config ?? null,
      defaultUserState: typedPayload.default_user_state ?? null,
      dashboardState: typedPayload.dashboard_state ?? null,
      contentVersion: typedPayload.content_version ?? null,
      deliveryMode: "protected_runtime"
    };
  }

  throw new Error("Protected runtime bootstrap format not recognized.");
}

function getDefaultRuntimeStorage(): RuntimeStorageLike | null {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

function loadCachedRuntimeBootstrap(storage: RuntimeStorageLike | null): CasesPayload | null {
  if (!storage) return null;

  try {
    const raw = storage.getItem(RUNTIME_BOOTSTRAP_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CasesPayload;
    if (parsed?.deliveryMode !== "protected_runtime" || !Array.isArray(parsed.cases) || parsed.cases.length) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveCachedRuntimeBootstrap(storage: RuntimeStorageLike | null, payload: CasesPayload) {
  if (!storage) return;

  try {
    storage.setItem(RUNTIME_BOOTSTRAP_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Runtime cache is a resilience hint only; app startup should not depend on writing it.
  }
}

export async function loadCasesPayload(
  fetchImpl: typeof fetch = fetch,
  storage: RuntimeStorageLike | null = getDefaultRuntimeStorage()
): Promise<CasesPayload> {
  const bootstrapPath = getRuntimeAssetPath("runtime_bootstrap.json");

  try {
    const bootstrapResponse = await fetchImpl(bootstrapPath, { cache: "no-store" });
    if (!bootstrapResponse.ok) {
      throw new Error(`Failed to load protected runtime bootstrap: ${bootstrapResponse.status}`);
    }

    const payload = normalizeCasesPayload(await bootstrapResponse.json());
    saveCachedRuntimeBootstrap(storage, payload);
    return payload;
  } catch (error) {
    const cachedPayload = loadCachedRuntimeBootstrap(storage);
    if (cachedPayload) return cachedPayload;
    const detail = error instanceof Error ? error.message : String(error);
    throw new RuntimeBootstrapError(`Unable to load protected runtime bootstrap from ${bootstrapPath}: ${detail}`, {
      cause: error
    });
  }
}
