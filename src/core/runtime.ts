import type { CasesPayload, RuntimeConfig } from "./types";

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
  if (Array.isArray(payload)) {
    return {
      cases: payload,
      progressionConfig: null,
      defaultUserState: null,
      dashboardState: null
    };
  }

  if (payload && typeof payload === "object" && Array.isArray((payload as { cases?: unknown[] }).cases)) {
    const typedPayload = payload as {
      cases: CasesPayload["cases"];
      progression_config?: CasesPayload["progressionConfig"];
      default_user_state?: CasesPayload["defaultUserState"];
      dashboard_state?: CasesPayload["dashboardState"];
    };

    return {
      cases: typedPayload.cases,
      progressionConfig: typedPayload.progression_config ?? null,
      defaultUserState: typedPayload.default_user_state ?? null,
      dashboardState: typedPayload.dashboard_state ?? null
    };
  }

  throw new Error("JSON format not recognized.");
}

export async function loadCasesPayload(fetchImpl: typeof fetch = fetch): Promise<CasesPayload> {
  const response = await fetchImpl(getRuntimeAssetPath("abg_cases.json"), { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load JSON: ${response.status}`);
  }

  return normalizeCasesPayload(await response.json());
}
