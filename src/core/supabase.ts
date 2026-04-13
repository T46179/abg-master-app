import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { RuntimeConfig, SupabaseSyncAdapter } from "./types";

export interface SupabaseRuntime extends SupabaseSyncAdapter {
  supabase: SupabaseClient | null;
}

const supabaseClientCache = new Map<string, SupabaseClient>();

export function createRuntimeSupabaseClient(config: RuntimeConfig): SupabaseRuntime {
  const supabaseEnabled = Boolean(config.SUPABASE_URL) && Boolean(config.SUPABASE_ANON_KEY);
  const cacheKey = `${String(config.SUPABASE_URL ?? "")}::${String(config.SUPABASE_ANON_KEY ?? "")}`;
  let supabase: SupabaseClient | null = null;

  if (supabaseEnabled) {
    supabase = supabaseClientCache.get(cacheKey) ?? null;

    if (!supabase) {
      supabase = createClient(String(config.SUPABASE_URL), String(config.SUPABASE_ANON_KEY));
      supabaseClientCache.set(cacheKey, supabase);
    }
  }

  return {
    supabase,
    supabaseEnabled,
    userId: null
  };
}

async function signInAnonymous(supabase: SupabaseClient): Promise<boolean> {
  const { error } = await supabase.auth.signInAnonymously();
  return !error;
}

async function getVerifiedUser(supabase: SupabaseClient) {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return null;
  }

  return data.user;
}

export async function ensureAnonymousSession(runtime: SupabaseRuntime): Promise<{ userId: string | null; syncUnavailable: boolean }> {
  if (!runtime.supabaseEnabled || !runtime.supabase) {
    return { userId: null, syncUnavailable: false };
  }

  try {
    const {
      data: { session }
    } = await runtime.supabase.auth.getSession();

    if (!session && !await signInAnonymous(runtime.supabase)) {
      return { userId: null, syncUnavailable: true };
    }

    let user = await getVerifiedUser(runtime.supabase);

    if (!user) {
      await runtime.supabase.auth.signOut();

      if (!await signInAnonymous(runtime.supabase)) {
        return { userId: null, syncUnavailable: true };
      }

      user = await getVerifiedUser(runtime.supabase);
      if (!user) {
        return { userId: null, syncUnavailable: true };
      }
    }

    runtime.userId = user.id;
    return {
      userId: runtime.userId,
      syncUnavailable: false
    };
  } catch {
    return { userId: null, syncUnavailable: true };
  }
}
