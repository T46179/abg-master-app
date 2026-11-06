// @vitest-environment jsdom
import { act, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { Link, MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BackgroundAccount } from "./BackgroundAccount";
import { useBackgroundAccount } from "./AccountLoading";
import { SiteAccountProvider, useSiteAccount } from "./SiteAccountProvider";
import { useAppContext } from "./AppProvider";
import { AppShell } from "../presentation/layout/AppShell";

vi.mock("../core/progressionSync", () => ({ loadRemoteProgressRow: vi.fn(async () => null), completeCalibrationProgress: vi.fn() }));
vi.mock("../core/analytics", () => ({ trackEvent: vi.fn(), trackPageView: vi.fn() }));
vi.mock("../presentation/layout/MainNav", () => ({ MainNav: () => <nav>Navigation</nav> }));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const config = { SUPABASE_URL: "https://clpfecuohwzwrgmqzeos.supabase.co", SUPABASE_ANON_KEY: "public" };
const payload = { deliveryMode: "protected_runtime" as const, contentVersion: "test", cases: [], progressionConfig: null, dashboardState: null, defaultUserState: null };
const loadPayload = vi.fn(async () => payload);
let mounts = 0;
function Public() {
  const background = useBackgroundAccount()!;
  const { state } = useAppContext();
  useEffect(() => { mounts++; }, []);
  return <><h1>Public content</h1><Link to="/practice?source=landing">Start</Link>
    <span>owner:{state.userId ?? "none"}</span><button onClick={background.retry}>Verify again</button></>;
}
let account: ReturnType<typeof useSiteAccount>["account"];
function Capture() { account = useSiteAccount().account; const location = useLocation(); return <span>{location.pathname + location.search}</span>; }
let root: ReturnType<typeof createRoot>;
let host: HTMLDivElement;
function deferred<T>() { let resolve!: (v: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
function fixture() {
  let id = "a";
  let event: (event: string, session: unknown) => void = () => {};
  const auth = {
    getSession: vi.fn(async () => ({ data: { session: { user: { id }, access_token: "token" } }, error: null })),
    getUser: vi.fn(async () => ({ data: { user: { id, is_anonymous: false, email: id + "@example.test", email_confirmed_at: "yes" } }, error: null })),
    signInAnonymously: vi.fn(async () => ({ error: null })),
    onAuthStateChange: vi.fn(callback => { event = callback; return { data: { subscription: { unsubscribe: vi.fn() } } }; })
  };
  return { auth, client: { auth } as unknown as SupabaseClient,
    change(next: string) { id = next; event("SIGNED_IN", { user: { id } }); },
    signOut() { event("SIGNED_OUT", null); } };
}
async function render(f: ReturnType<typeof fixture>, path = "/") {
  await act(async () => root.render(<SiteAccountProvider client={f.client}>
    <BackgroundAccount client={f.client} config={config} loadPayload={loadPayload}>
      <MemoryRouter initialEntries={[path]}><Capture /><Routes><Route path="/" element={<Public />} />
        <Route element={<AppShell />}><Route path="practice" element={<p>Private Practice</p>} /><Route path="sign-in" element={<p>Sign in form</p>} /></Route>
      </Routes></MemoryRouter>
    </BackgroundAccount>
  </SiteAccountProvider>));
}
beforeEach(() => { vi.useFakeTimers(); localStorage.clear(); mounts = 0; loadPayload.mockClear(); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); });

it("keeps public content mounted through verification, account changes and sign-out", async () => {
  const f = fixture(); const pending = deferred<any>(); f.auth.getUser.mockReturnValueOnce(pending.promise);
  await render(f);
  expect(host.textContent).toContain("Public content"); expect(host.textContent).toContain("owner:none");
  expect(loadPayload).not.toHaveBeenCalled(); expect(f.auth.signInAnonymously).not.toHaveBeenCalled();
  await act(async () => pending.resolve({ data: { user: { id: "a", is_anonymous: false, email: "a@example.test", email_confirmed_at: "yes" } }, error: null }));
  expect(host.textContent).toContain("owner:a"); expect(mounts).toBe(1);
  await act(async () => f.change("b")); expect(host.textContent).not.toContain("owner:a");
  await act(async () => vi.advanceTimersByTimeAsync(0)); expect(host.textContent).toContain("owner:b");
  await act(async () => f.signOut()); expect(host.textContent).toContain("owner:none"); expect(mounts).toBe(1);
});

it("preserves a direct URL and navigation while verification is slow, then offers a scoped retry", async () => {
  const f = fixture(); f.auth.getUser.mockImplementation(() => new Promise(() => {}));
  await render(f, "/practice?source=direct");
  expect(host.textContent).toContain("Navigation"); expect(host.textContent).toContain("/practice?source=direct");
  expect(host.textContent).not.toContain("Private Practice");
  await act(async () => vi.advanceTimersByTimeAsync(3000)); expect(host.textContent).toContain("Connecting…");
  await act(async () => vi.advanceTimersByTimeAsync(12000)); expect(host.textContent).toContain("longer than usual");
  await act(async () => host.querySelector<HTMLButtonElement>("button")!.click());
  expect(host.textContent).not.toContain("longer than usual"); expect(f.auth.getUser).toHaveBeenCalledTimes(2);
  expect(f.auth.signInAnonymously).not.toHaveBeenCalled();
});

it("keeps public content on verification failure and allows recovery pages", async () => {
  const f = fixture(); f.auth.getUser.mockRejectedValue(new Error("offline"));
  await render(f); expect(host.textContent).toContain("Public content"); expect(host.textContent).toContain("owner:none");
  expect(f.auth.signInAnonymously).not.toHaveBeenCalled();
  await act(async () => root.unmount()); root = createRoot(host);
  await render(f, "/sign-in?return_to=trial"); expect(host.textContent).toContain("Sign in form");
});

it("supersedes an old verification without clearing the session", async () => {
  const f = fixture(); const pending = deferred<any>(); f.auth.getUser.mockReturnValueOnce(pending.promise);
  await render(f);
  await act(async () => account.refresh()); expect(host.textContent).toContain("owner:a");
  await act(async () => pending.resolve({ data: { user: null }, error: { status: 503 } }));
  expect(host.textContent).toContain("owner:a"); expect(mounts).toBe(1);
});

it("accepts a successful verification after the slow threshold without restarting public content", async () => {
  const f = fixture(); const pending = deferred<any>(); f.auth.getUser.mockReturnValueOnce(pending.promise);
  await render(f); await act(async () => vi.advanceTimersByTimeAsync(16000));
  await act(async () => pending.resolve({ data: { user: { id: "a", is_anonymous: true } }, error: null }));
  expect(host.textContent).toContain("owner:a"); expect(mounts).toBe(1);
  expect(f.auth.signInAnonymously).not.toHaveBeenCalled();
});

it("navigates from the public landing page while identity is unresolved", async () => {
  const f = fixture(); f.auth.getUser.mockImplementation(() => new Promise(() => {}));
  await render(f);
  await act(async () => host.querySelector<HTMLAnchorElement>("a")!.click());
  expect(host.textContent).toContain("/practice?source=landing"); expect(host.textContent).toContain("Navigation");
  expect(host.textContent).not.toContain("Private Practice"); expect(f.auth.signInAnonymously).not.toHaveBeenCalled();
});

it("creates a guest only on entering a learner route after confirmed session absence", async () => {
  const f = fixture(); f.auth.getSession.mockResolvedValueOnce({ data: { session: null }, error: null } as any);
  await render(f); expect(f.auth.signInAnonymously).not.toHaveBeenCalled();
  f.auth.getSession.mockResolvedValueOnce({ data: { session: null }, error: null } as any);
  await act(async () => host.querySelector<HTMLAnchorElement>("a")!.click());
  expect(f.auth.signInAnonymously).toHaveBeenCalledTimes(1);
});
