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
    SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
    ENABLE_PROTECTED_CASE_DELIVERY: String(import.meta.env.VITE_ENABLE_PROTECTED_CASE_DELIVERY ?? "").toLowerCase() === "true"
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

  if (Array.isArray(payload)) {
    return {
      cases: payload,
      progressionConfig: null,
      defaultUserState: null,
      dashboardState: null,
      contentVersion: null,
      deliveryMode: "public_catalog"
    };
  }

  if (payload && typeof payload === "object" && Array.isArray((payload as { cases?: unknown[] }).cases)) {
    const typedPayload = payload as {
      cases: CasesPayload["cases"];
      progression_config?: CasesPayload["progressionConfig"];
      default_user_state?: CasesPayload["defaultUserState"];
      dashboard_state?: CasesPayload["dashboardState"];
      content_version?: string | null;
    };

    return {
      cases: typedPayload.cases,
      progressionConfig: typedPayload.progression_config ?? null,
      defaultUserState: typedPayload.default_user_state ?? null,
      dashboardState: typedPayload.dashboard_state ?? null,
      contentVersion: typedPayload.content_version ?? null,
      deliveryMode: "public_catalog"
    };
  }

  throw new Error("JSON format not recognized.");
}

export async function loadCasesPayload(fetchImpl: typeof fetch = fetch): Promise<CasesPayload> {
  if (String(import.meta.env.VITE_ENABLE_PROTECTED_CASE_DELIVERY ?? "").toLowerCase() === "true") {
    const bootstrapResponse = await fetchImpl(getRuntimeAssetPath("runtime_bootstrap.json"), { cache: "no-store" });
    if (bootstrapResponse.ok) {
      return normalizeCasesPayload(await bootstrapResponse.json());
    }
  }

  const response = await fetchImpl(getRuntimeAssetPath("abg_cases.json"), { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load JSON: ${response.status}`);
  }

  return normalizeCasesPayload(await response.json());
}
