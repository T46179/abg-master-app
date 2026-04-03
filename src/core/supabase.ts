import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { RuntimeConfig, SupabaseSyncAdapter } from "./types";

export interface SupabaseRuntime extends SupabaseSyncAdapter {
  supabase: SupabaseClient | null;
}

export function createRuntimeSupabaseClient(config: RuntimeConfig): SupabaseRuntime {
  const supabaseEnabled = Boolean(config.SUPABASE_URL) && Boolean(config.SUPABASE_ANON_KEY);
  const supabase = supabaseEnabled
    ? createClient(String(config.SUPABASE_URL), String(config.SUPABASE_ANON_KEY))
    : null;

  return {
    supabase,
    supabaseEnabled,
    userId: null
  };
}

export async function ensureAnonymousSession(runtime: SupabaseRuntime): Promise<{ userId: string | null; syncUnavailable: boolean }> {
  if (!runtime.supabaseEnabled || !runtime.supabase) {
    return { userId: null, syncUnavailable: false };
  }

  try {
    const {
      data: { session }
    } = await runtime.supabase.auth.getSession();

    if (!session) {
      const { error } = await runtime.supabase.auth.signInAnonymously();
      if (error) {
        return { userId: null, syncUnavailable: true };
      }
    }

    const {
      data: { user }
    } = await runtime.supabase.auth.getUser();

    runtime.userId = user?.id ?? null;
    return {
      userId: runtime.userId,
      syncUnavailable: false
    };
  } catch {
    return { userId: null, syncUnavailable: true };
  }
}
