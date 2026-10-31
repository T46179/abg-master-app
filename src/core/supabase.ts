import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { RuntimeConfig, SupabaseSyncAdapter } from "./types";

export interface SupabaseRuntime extends SupabaseSyncAdapter {
  supabase: SupabaseClient | null;
}

const supabaseClientCache = new Map<string, SupabaseClient>();

export function createRuntimeSupabaseClient(config: RuntimeConfig, options?: { manualCallback?: boolean }): SupabaseRuntime {
  const supabaseEnabled = Boolean(config.SUPABASE_URL) && Boolean(config.SUPABASE_ANON_KEY);
  const cacheKey = `${String(config.SUPABASE_URL ?? "")}::${String(config.SUPABASE_ANON_KEY ?? "")}::${Boolean(options?.manualCallback)}`;
  let supabase: SupabaseClient | null = null;

  if (supabaseEnabled) {
    supabase = supabaseClientCache.get(cacheKey) ?? null;

    if (!supabase) {
      supabase = createClient(String(config.SUPABASE_URL), String(config.SUPABASE_ANON_KEY), options?.manualCallback ? { auth: { detectSessionInUrl: false, flowType: "implicit" } } : undefined);
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
  return { user: data.user, error };
}

export async function ensureAnonymousSession(runtime: SupabaseRuntime): Promise<{ userId: string | null; syncUnavailable: boolean }> {
  if (!runtime.supabaseEnabled || !runtime.supabase) {
    return { userId: null, syncUnavailable: false };
  }

  try {
    const {
      data: { session }, error: sessionError
    } = await runtime.supabase.auth.getSession();

    // A failed session read is not evidence that the learner needs a new identity.
    if (sessionError) return { userId: null, syncUnavailable: true };

    if (!session && !await signInAnonymous(runtime.supabase)) {
      return { userId: null, syncUnavailable: true };
    }

    let verified = await getVerifiedUser(runtime.supabase);

    if (verified.error || !verified.user) {
      // Only a confirmed invalid, explicitly anonymous session may be replaced.
      // Never discard a permanent/unknown identity or sign out after a network error.
      const canRecoverGuest = session?.user?.is_anonymous === true
        && (verified.error?.status === 401 || verified.error?.status === 403);
      if (!canRecoverGuest) return { userId: null, syncUnavailable: true };

      const { error: signOutError } = await runtime.supabase.auth.signOut({ scope: "local" });
      if (signOutError || !await signInAnonymous(runtime.supabase)) {
        return { userId: null, syncUnavailable: true };
      }

      verified = await getVerifiedUser(runtime.supabase);
      if (verified.error || !verified.user) {
        return { userId: null, syncUnavailable: true };
      }
    }

    runtime.userId = verified.user.id;
    return {
      userId: runtime.userId,
      syncUnavailable: false
    };
  } catch {
    return { userId: null, syncUnavailable: true };
  }
}
