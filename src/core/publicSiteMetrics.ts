import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadRuntimeConfig } from "./runtime";

let publicClient: SupabaseClient | null = null;

/** Public aggregate reads never discover, create, or refresh an account session. */
export async function loadPublicCasesSolvedCount(signal: AbortSignal): Promise<number | null> {
  if (!publicClient) {
    const config = await loadRuntimeConfig();
    if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) return null;
    publicClient ??= createClient(String(config.SUPABASE_URL), String(config.SUPABASE_ANON_KEY), {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: "abgmaster-public-site-metrics"
      }
    });
  }

  const { data, error } = await publicClient
    .from("public_site_metrics")
    .select("metric_value")
    .eq("metric_key", "cases_solved")
    .abortSignal(signal)
    .maybeSingle();

  const value = data?.metric_value;
  if (error || value === null || value === undefined || value === ""
    || (typeof value !== "number" && typeof value !== "string")
    || (typeof value === "string" && !value.trim())) return null;
  const count = Number(value);
  return Number.isSafeInteger(count) && count >= 0 ? count : null;
}
