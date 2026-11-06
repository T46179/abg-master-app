import type { SupabaseClient } from "@supabase/supabase-js";

export type SiteAccountStatus = "checking" | "guest" | "verified" | "unverified" | "signed_out" | "unavailable";
export type SiteAccountSnapshot = Readonly<{
  status: SiteAccountStatus;
  userId: string | null;
  email: string | null;
  generation: number;
}>;

/** One controller per environment's canonical client. This conveys identity,
 * never Exam permission or paid access. No credentials enter its snapshots. */
export function createSiteAccount(client: SupabaseClient) {
  let snapshot: SiteAccountSnapshot = Object.freeze({ status: "checking", userId: null, email: null, generation: 0 });
  const listeners = new Set<() => void>();
  let revision = 0;
  let started = false;
  let guestRequest: Promise<void> | null = null;
  let unsubscribe: (() => void) | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function publish(status: SiteAccountStatus, userId: string | null = null, email: string | null = null) {
    if (snapshot.status === status && snapshot.userId === userId && snapshot.email === email) return;
    snapshot = Object.freeze({ status, userId, email,
      generation: snapshot.generation + Number(userId !== snapshot.userId) });
    listeners.forEach(listener => listener());
  }

  function verificationFailed(cause: unknown, expectedId?: string) {
    const error = cause && typeof cause === "object" ? cause as { status?: number } : undefined;
    // The SDK wraps failed fetches as AuthRetryableFetchError (status 0), and
    // gateway failures as 502/503/504. These do not establish a different owner.
    const retryable = error && (error.status === 0 || [429, 502, 503, 504].includes(error.status ?? -1));
    if (retryable && snapshot.status === "verified" && snapshot.userId && (!expectedId || expectedId === snapshot.userId)) return;
    publish("unavailable");
  }

  async function refresh() {
    if (timer !== undefined) { clearTimeout(timer); timer = undefined; }
    const ticket = ++revision;
    let expectedId: string | undefined;
    try {
      const session = await client.auth.getSession();
      if (!started || ticket !== revision) return;
      if (session.error) { verificationFailed(session.error); return; }
      if (!session.data.session) { publish("signed_out"); return; }
      // Only the verified response establishes identity; session metadata is a hint.
      expectedId = session.data.session.user.id;
      if (expectedId !== snapshot.userId) publish("checking");
      const result = await client.auth.getUser();
      if (!started || ticket !== revision) return;
      const user = result.data.user;
      if (result.error) { verificationFailed(result.error, expectedId); return; }
      if (!user || user.id !== expectedId || typeof user.is_anonymous !== "boolean") {
        publish("unavailable"); return;
      }
      if (session.data.session.user.is_anonymous === true && user.is_anonymous === false && user.email_confirmed_at) {
        const refreshed = await client.auth.refreshSession();
        if (!started || ticket !== revision) return;
        if (refreshed.error) { verificationFailed(refreshed.error, expectedId); return; }
      }
      publish(user.is_anonymous ? "guest" : user.email && user.email_confirmed_at ? "verified" : "unverified",
        user.id, user.is_anonymous ? null : user.email ?? null);
    } catch (cause) {
      if (started && ticket === revision) verificationFailed(cause, expectedId);
    }
  }

  function scheduleRefresh() {
    if (timer !== undefined) clearTimeout(timer);
    // Do not call Auth methods from inside the SDK's locked event callback.
    timer = setTimeout(() => { timer = undefined; void refresh(); }, 0);
  }

  function stop() {
    started = false;
    revision += 1;
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    unsubscribe?.();
    unsubscribe = undefined;
  }

  function start() {
    if (started) return;
    started = true;
    const { data } = client.auth.onAuthStateChange((event, session) => {
      if (!started) return;
      revision += 1;
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
      if (event === "SIGNED_OUT") { publish("signed_out"); return; }
      // Hide the old account immediately, including changes originating in another tab.
      if ((session?.user.id ?? null) !== snapshot.userId) publish("checking");
      scheduleRefresh();
    });
    unsubscribe = () => data.subscription.unsubscribe();
    void refresh();
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    start, stop, refresh,
    async retryVerification() {
      if (!started) return;
      publish("checking");
      await refresh();
    },
    async signIn(email: string, password: string) {
      if (!started) throw new Error("Account service is not running.");
      const result = await client.auth.signInWithPassword({ email: email.trim(), password });
      if (result.error) throw new Error("Sign-in could not be completed. Check your details or recover your account.");
      await refresh();
    },
    async signOut() {
      if (!started) throw new Error("Account service is not running.");
      const result = await client.auth.signOut({ scope: "local" });
      if (result.error) throw new Error("Sign-out could not be completed. Please retry.");
      await refresh();
    },
    async continueAsGuest() {
      if (guestRequest) return guestRequest;
      guestRequest = (async () => {
        if (!started) throw new Error("Account service is not running.");
        const ticket = revision;
        const session = await client.auth.getSession();
        if (session.error) throw new Error("Your existing sign-in could not be checked. Please retry.");
        if (!started || ticket !== revision) { await refresh(); return; }
        if (!session.data.session) {
          const result = await client.auth.signInAnonymously();
          if (result.error) throw new Error("Guest Practice could not be started. Please retry.");
        }
        await refresh();
      })();
      try { await guestRequest; } finally { guestRequest = null; }
    },
    isCurrent(generation: number, userId: string) {
      return started && snapshot.generation === generation && snapshot.userId === userId
        && ["guest", "verified", "unverified"].includes(snapshot.status);
    }
  };
}

export type SiteAccount = ReturnType<typeof createSiteAccount>;
