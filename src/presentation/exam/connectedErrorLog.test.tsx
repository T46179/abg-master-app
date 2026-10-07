// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ErrorLogSave } from "./ErrorLogSave";
import { ConnectedExamErrorLog } from "./ConnectedExamErrorLog";
import { useExamErrorLog } from "./useExamErrorLog";
import type { ErrorLogState } from "./errorLogTypes";
import type { RuntimeCall } from "../../core/examRuntime";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const attempt = "12345678-1234-1234-1234-123456789abc";
const catalogue = { topics: [{ id: "acid_base", label: "Acid–base" }], concepts: [
  { id: "calculation", label: "Current calculation label", topicId: "acid_base", errorType: "Calculation", active: true },
] };
function state(source: string | null = null): ErrorLogState {
  return { catalogue, entries: [{ conceptId: "calculation", status: "to_review", exampleCount: 21,
    createdAt: "2026-10-07T01:00:00Z", lastSavedAt: "2026-10-07T02:00:00Z", archivedAt: null, reopenedAt: null }],
    attemptId: source, savedSources: source ? { part: ["calculation"] } : {}, toReviewCount: 1 };
}
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (cause: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => { container = document.createElement("div"); document.body.append(container); root = createRoot(container); });
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
async function click(text: string) {
  const button = [...container.querySelectorAll("button")].find(b => b.textContent?.trim() === text)!;
  expect(button).toBeTruthy(); await act(async () => button.click());
}

it("preserves selections after failure, blocks repeated saves and waits for confirmed props", async () => {
  const first = deferred<void>(); const second = deferred<void>();
  const save = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  const concepts = [{ id: "calculation", label: "Calculation" }, { id: "interpretation", label: "Interpretation" }];
  await act(async () => root.render(<ErrorLogSave concepts={concepts} onSave={save} />));
  await act(async () => container.querySelector<HTMLInputElement>("input")!.click());
  await click("Add 1 to error log");
  expect(container.querySelector<HTMLButtonElement>("button")!.disabled).toBe(true);
  expect(container.textContent).not.toContain("Already saved");
  await act(async () => first.reject(new Error("offline")));
  expect(container.querySelector<HTMLInputElement>("input")!.checked).toBe(true);
  expect(container.querySelector('[role="alert"]')).not.toBeNull();
  await click("Add 1 to error log");
  await act(async () => second.resolve());
  expect(save).toHaveBeenCalledTimes(2);
  expect(save.mock.calls[1][0]).toEqual(["calculation"]);
  expect(container.textContent).not.toContain("Already saved");
  await act(async () => root.render(<ErrorLogSave concepts={[{ ...concepts[0], saved: true }, concepts[1]]} onSave={save} />));
  expect(container.textContent).toContain("Calculation· Already saved");
});

it("loads examples only once on expansion, paginates and uses the exact saved Part", async () => {
  const example = { id: attempt, attemptId: attempt, unitId: "EXAM-0001", partId: "historical_part",
    prompt: "Original prompt", questionNumber: 2, partNumber: 3, examKind: "mock" as const,
    finishedAt: "2026-10-06T01:00:00Z", savedAt: "2026-10-07T01:00:00Z" };
  const cursor = { id: example.id, savedAt: example.savedAt };
  const examples = vi.fn().mockResolvedValueOnce({ examples: [example], nextCursor: cursor })
    .mockResolvedValueOnce({ examples: [{ ...example, id: "22345678-1234-1234-1234-123456789abc" }], nextCursor: null });
  const open = vi.fn().mockResolvedValue(undefined); const review = vi.fn().mockRejectedValue(new Error("offline"));
  const log = { data: state(), loading: false, error: "", busy: false, refresh: vi.fn(), save: vi.fn(), review,
    client: { list: vi.fn(), save: vi.fn(), review: vi.fn(), examples } } as ReturnType<typeof useExamErrorLog>;
  await act(async () => root.render(<ConnectedExamErrorLog log={log} onBack={vi.fn()} onOpenExample={open} />));
  expect(examples).toHaveBeenCalledTimes(1);
  expect(container.textContent).toContain("21 examples");
  expect(container.textContent).toContain("Current calculation label");
  await click("Load more");
  expect(examples).toHaveBeenLastCalledWith("calculation", cursor);
  expect(container.querySelectorAll(".exam-error-log__examples button")).toHaveLength(2);
  await act(async () => container.querySelector<HTMLButtonElement>(".exam-error-log__examples button")!.click());
  expect(open).toHaveBeenCalledWith(attempt, "historical_part");
  await click("Archive");
  expect(container.textContent).toContain("Couldn’t confirm the review state");
  expect(container.querySelector('.exam-error-log__tabs button')!.textContent).toBe("To review 1");
});

it("retries failed example loads and hides the latest-result action when there is no attempt", async () => {
  const examples = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue({ examples: [], nextCursor: null });
  const log = { data: state(), loading: false, error: "", busy: false, refresh: vi.fn(), save: vi.fn(), review: vi.fn(),
    client: { list: vi.fn(), save: vi.fn(), review: vi.fn(), examples } } as ReturnType<typeof useExamErrorLog>;
  await act(async () => root.render(<ConnectedExamErrorLog log={log} onBack={vi.fn()} onOpenExample={vi.fn()} />));
  await click("Retry"); expect(examples).toHaveBeenCalledTimes(2);
  await act(async () => root.render(<ConnectedExamErrorLog log={{ ...log, data: { ...state(), entries: [], toReviewCount: 0 } }} onBack={vi.fn()} onOpenExample={vi.fn()} />));
  expect(container.textContent).toContain("Nothing saved yet");
  expect(container.textContent).not.toContain("Review latest result");
});

it("does not fetch archived examples until their row is actually expanded", async () => {
  const examples = vi.fn().mockResolvedValue({ examples: [], nextCursor: null });
  const data = state();
  data.catalogue = { ...catalogue, concepts: [...catalogue.concepts, { ...catalogue.concepts[0], id: "archived_concept", label: "Archived area" }] };
  data.entries = [...data.entries, { ...data.entries[0], conceptId: "archived_concept", status: "archived", archivedAt: "2026-10-07T03:00:00Z" }];
  const log = { data, loading: false, error: "", busy: false, refresh: vi.fn(), save: vi.fn(), review: vi.fn(),
    client: { list: vi.fn(), save: vi.fn(), review: vi.fn(), examples } } as ReturnType<typeof useExamErrorLog>;
  await act(async () => root.render(<ConnectedExamErrorLog log={log} onBack={vi.fn()} onOpenExample={vi.fn()} />));
  expect(examples.mock.calls.map(c => c[0])).toEqual(["calculation"]);
  await click("Archived 1");
  expect(examples).toHaveBeenCalledTimes(1);
  await act(async () => container.querySelector<HTMLButtonElement>(".exam-error-log__row")!.click());
  expect(examples.mock.calls.map(c => c[0])).toEqual(["calculation", "archived_concept"]);
});

it("clears account/environment state and ignores delayed responses from the old account", async () => {
  const old = deferred<ErrorLogState>(); const fresh = deferred<ErrorLogState>();
  const call = vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise) as unknown as RuntimeCall;
  let log!: ReturnType<typeof useExamErrorLog>;
  function Harness({ account }: { account: string }) { log = useExamErrorLog(call, account); return <span>{log.data?.toReviewCount ?? "loading"}</span>; }
  await act(async () => root.render(<Harness account="staging:alice" />));
  await act(async () => root.render(<Harness account="other:bob" />));
  await act(async () => old.resolve(state()));
  expect(log.data).toBeUndefined();
  await act(async () => fresh.resolve({ ...state(), entries: [], toReviewCount: 0 }));
  expect(log.data?.toReviewCount).toBe(0);
});

it("uses only confirmed mutation state, rejects concurrent actions and refreshes on focus", async () => {
  const mutation = deferred<ErrorLogState>();
  const call = vi.fn().mockImplementation((operation: string) => operation === "error_log_save" ? mutation.promise : Promise.resolve(state(attempt)));
  let log!: ReturnType<typeof useExamErrorLog>;
  function Harness() { log = useExamErrorLog(call as RuntimeCall, "staging:alice", attempt); return <span>{log.busy ? "busy" : "ready"}</span>; }
  await act(async () => root.render(<Harness />));
  let saving!: Promise<void>;
  await act(async () => { saving = log.save("part", ["calculation"]); });
  expect(log.busy).toBe(true);
  await expect(log.review("calculation", true)).rejects.toThrow("still saving");
  await act(async () => window.dispatchEvent(new Event("focus")));
  expect(call.mock.calls.filter(c => c[0] === "error_log_list")).toHaveLength(1);
  await act(async () => { mutation.resolve({ ...state(attempt), savedConceptIds: ["calculation"] } as ErrorLogState); await saving; });
  expect(log.busy).toBe(false);
  await act(async () => window.dispatchEvent(new Event("focus")));
  expect(call.mock.calls.filter(c => c[0] === "error_log_list")).toHaveLength(2);
});
