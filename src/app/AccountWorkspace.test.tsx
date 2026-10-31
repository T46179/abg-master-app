// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SiteAccountProvider, useSiteAccount } from "./SiteAccountProvider";
import { AccountWorkspaceProvider, useAccountBrowserStorage } from "./AccountWorkspace";
import { AppProvider, useAppContext } from "./AppProvider";
import ExamPilotAuthScreen from "../presentation/screens/ExamPilotAuthScreen";
import { createAccountBrowserStorage } from "../core/accountBrowserStorage";
import { createPendingCalibrationCompletion, savePendingCalibrationCompletion, loadPendingCalibrationCompletion } from "../core/calibrationRecovery";
import type { UserState } from "../core/types";

const mocks = vi.hoisted(() => ({ progress: vi.fn(), access: vi.fn(), legacy: vi.fn(), complete: vi.fn() }));
vi.mock("../core/runtime", () => ({ loadRuntimeConfig: vi.fn(), loadCasesPayload: vi.fn(),
  isRuntimeBootstrapError: () => false, getRuntimeBootstrapUserMessage: () => "unavailable" }));
vi.mock("../core/progressionSync", () => ({ loadRemoteProgressRow: mocks.progress, completeCalibrationProgress: mocks.complete }));
vi.mock("../core/examAuth", () => ({ readExamAccess: mocks.access, createExamAuthClient: mocks.legacy }));
vi.mock("../presentation/exam/ExamPilotRuntime", () => ({ default: ({ userId, canStart }: { userId: string; canStart: boolean }) => <p>Exam owner:{userId};start:{String(canStart)}</p> }));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const config = { SUPABASE_URL: "https://clpfecuohwzwrgmqzeos.supabase.co", SUPABASE_ANON_KEY: "public" };
const payload = { deliveryMode: "protected_runtime" as const, contentVersion: "staging-content", cases: [], progressionConfig: null, dashboardState: null, defaultUserState: null };
const loadPayload = async () => payload;
let oldSave: ((state: UserState) => Promise<void>) | undefined;
let oldState: UserState;
let oldStorage: ReturnType<typeof useAccountBrowserStorage>;
function Probe() {
  const { state, setUserState, patchPracticeState } = useAppContext();
  const storage = useAccountBrowserStorage();
  if (state.userId === "a") { oldSave = setUserState; oldState = state.userState; oldStorage = storage; }
  return <>
    <p>Practice owner:{state.userId};xp:{state.userState.xp};case:{state.practiceState.currentCaseToken ?? "empty"}</p>
    <p>Draft:{storage.getItem("unfinished-work") ?? "empty"}</p>
    <button onClick={() => { storage.setItem("unfinished-work", "A draft"); patchPracticeState({ currentCaseToken: "A case" }); }}>Save work</button>
    <ExamPilotAuthScreen />
  </>;
}
function Host({ client }: { client: SupabaseClient }) {
  const { identity } = useSiteAccount();
  return identity.userId ? <AccountWorkspaceProvider key={identity.generation} canonical={client} config={config} loadPayload={loadPayload}>
    <AppProvider><Probe /></AppProvider>
  </AccountWorkspaceProvider> : <p>Account:{identity.status}</p>;
}
function fixture() {
  let id = "a"; let guest = false;
  let changed: (event: string, session: unknown) => void = () => undefined;
  const client = { auth: {
    getSession: vi.fn(async () => ({ data: { session: { user: { id }, access_token: `token-${id}` } }, error: null })),
    getUser: vi.fn(async () => ({ data: { user: { id, is_anonymous: guest, email: guest ? undefined : `${id}@example.test`, email_confirmed_at: guest ? undefined : "confirmed" } }, error: null })),
    onAuthStateChange: vi.fn(callback => { changed = callback; return { data: { subscription: { unsubscribe: vi.fn() } } }; })
  } };
  return { client: client as unknown as SupabaseClient,
    switchTo(next: string, isGuest = false) { id = next; guest = isGuest; changed("SIGNED_IN", { user: { id } }); },
    signOut() { changed("SIGNED_OUT", null); },
    upgrade() { guest = false; changed("USER_UPDATED", { user: { id } }); }
  };
}
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
async function flush() { await act(async () => { await vi.advanceTimersByTimeAsync(0); }); }
beforeEach(() => {
  vi.useFakeTimers(); localStorage.clear(); mocks.progress.mockReset(); mocks.access.mockReset(); mocks.legacy.mockReset(); mocks.complete.mockReset();
  mocks.progress.mockResolvedValue(null); mocks.access.mockResolvedValue({ status: "not_invited", allowedUnitCounts: [] });
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.useRealTimers(); });
async function render(f: ReturnType<typeof fixture>) {
  await act(async () => root.render(<SiteAccountProvider client={f.client}><Host client={f.client} /></SiteAccountProvider>)); await flush();
}
describe("real app account boundary", () => {
  it("uses one identity for Practice and Exam, while retaining the server's access denial", async () => {
    const f = fixture(); await render(f);
    expect(container.textContent).toContain("Practice owner:a");
    expect(container.textContent).toContain("Exam owner:a;start:false");
    expect(container.textContent).toContain("does not have pilot access");
    expect(mocks.legacy).not.toHaveBeenCalled();
  });
  it("clears in-memory work and isolates drafts when switching, preserving the previous owner's saved copy", async () => {
    const f = fixture(); await render(f);
    await act(async () => container.querySelector<HTMLButtonElement>("button")!.click());
    expect(container.textContent).toContain("case:A case");
    await act(async () => { f.switchTo("b"); oldStorage.setItem("unfinished-work", "late overwrite"); });
    expect(container.textContent).not.toContain("Practice owner:a");
    await flush();
    expect(container.textContent).toContain("Practice owner:b");
    expect(container.textContent).toContain("case:empty");
    expect(container.textContent).toContain("Draft:empty");
    await act(async () => oldSave!({ ...oldState, xp: 999 }));
    expect(container.textContent).not.toContain("xp:999");
    await act(async () => f.switchTo("a")); await flush();
    expect(container.textContent).toContain("Draft:A draft");
    expect(container.textContent).not.toContain("xp:999");
  });
  it("ignores delayed remote hydration for the previous account", async () => {
    const f = fixture(); let finish!: (value: unknown) => void;
    mocks.progress.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    await render(f);
    await act(async () => f.switchTo("b")); await flush();
    await act(async () => finish({ xp: 999, level: 5 }));
    expect(container.textContent).toContain("Practice owner:b");
    expect(container.textContent).not.toContain("xp:999");
  });
  it("hides both areas on sign-out, keeps saved drafts, and creates no replacement guest", async () => {
    const f = fixture(); await render(f);
    await act(async () => container.querySelector<HTMLButtonElement>("button")!.click());
    await act(async () => f.signOut());
    expect(container.textContent).toBe("Account:signed_out");
    expect(createAccountBrowserStorage(localStorage, String(config.SUPABASE_URL), "a").storage.getItem("unfinished-work")).toBe("A draft");
  });
  it("keeps guest work during a same-ID registration upgrade and only then checks Exam access", async () => {
    const f = fixture(); f.switchTo("a", true); await render(f);
    await act(async () => container.querySelector<HTMLButtonElement>("button")!.click());
    expect(mocks.access).not.toHaveBeenCalled();
    await act(async () => f.upgrade()); await flush();
    expect(container.textContent).toContain("case:A case");
    expect(container.textContent).toContain("Draft:A draft");
    expect(mocks.access).toHaveBeenCalledTimes(1);
  });
  it("does not replay a pending calibration under the account switched into mid-retry", async () => {
    const aStorage = createAccountBrowserStorage(localStorage, String(config.SUPABASE_URL), "a").storage;
    savePendingCalibrationCompletion(aStorage, createPendingCalibrationCompletion({ operationId: "pending-a", calibrationVersion: 3, progressionVersion: "v2", betaReleaseNumber: 2 }));
    let finish!: (value: unknown) => void;
    mocks.progress.mockResolvedValueOnce(null).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const f = fixture(); await render(f);
    expect(mocks.progress).toHaveBeenCalledTimes(2);
    await act(async () => f.switchTo("b")); await flush();
    await act(async () => finish(null));
    expect(mocks.complete).not.toHaveBeenCalled();
    expect(loadPendingCalibrationCompletion(aStorage)?.operationId).toBe("pending-a");
    const bStorage = createAccountBrowserStorage(localStorage, String(config.SUPABASE_URL), "b").storage;
    expect(loadPendingCalibrationCompletion(bStorage)).toBeNull();
  });
  it("does not import unowned legacy progress into a different account", async () => {
    localStorage.setItem("abgmaster_userState", JSON.stringify({ xp: 999 }));
    const f = fixture(); await render(f);
    expect(container.textContent).not.toContain("xp:999");
    expect(localStorage.getItem("abgmaster_userState")).toContain("999");
  });
});
