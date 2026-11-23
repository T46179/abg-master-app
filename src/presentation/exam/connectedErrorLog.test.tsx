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
  expect(container.textContent).not.toContain("Saved");
  await act(async () => first.reject(new Error("offline")));
  expect(container.querySelector<HTMLInputElement>("input")!.checked).toBe(true);
  expect(container.querySelector('[role="alert"]')).not.toBeNull();
  await click("Add 1 to error log");
  await act(async () => second.resolve());
  expect(save).toHaveBeenCalledTimes(2);
  expect(save.mock.calls[1][0]).toEqual(["calculation"]);
  expect(container.textContent).not.toContain("Saved");
  await act(async () => root.render(<ErrorLogSave concepts={[{ ...concepts[0], saved: true }, concepts[1]]} onSave={save} />));
  expect(container.textContent).toContain("Calculation· Saved");
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
  expect(container.querySelector(".exam-error-log__examples")?.textContent).toContain("Standard Exam");
  await click("Load more");
  expect(examples).toHaveBeenLastCalledWith("calculation", cursor);
  expect(container.querySelectorAll(".exam-error-log__examples button")).toHaveLength(2);
  await act(async () => container.querySelector<HTMLButtonElement>(".exam-error-log__examples button")!.click());
  expect(open).toHaveBeenCalledWith(attempt, "historical_part");
  await click("Archive");
  expect(container.textContent).toContain("We couldn't confirm that change.");
  expect(container.querySelector(".exam-error-log__concept .exam-inline-error")?.textContent).toContain("We couldn't confirm that change.");
  expect(container.querySelector(".exam-notice")).toBeNull();
  expect(container.querySelector('.exam-error-log__tabs button')!.textContent).toBe("To review 1");
});

it("retries failed example loads and hides the latest-result action when there is no attempt", async () => {
  const examples = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue({ examples: [], nextCursor: null });
  const log = { data: state(), loading: false, error: "", busy: false, refresh: vi.fn(), save: vi.fn(), review: vi.fn(),
    client: { list: vi.fn(), save: vi.fn(), review: vi.fn(), examples } } as ReturnType<typeof useExamErrorLog>;
  await act(async () => root.render(<ConnectedExamErrorLog log={log} onBack={vi.fn()} onOpenExample={vi.fn()} />));
  await click("Retry"); expect(examples).toHaveBeenCalledTimes(2);
  await act(async () => root.render(<ConnectedExamErrorLog log={{ ...log, data: { ...state(), entries: [], toReviewCount: 0 } }} onBack={vi.fn()} onOpenExample={vi.fn()} />));
  expect(container.textContent).toContain("Your Error Log is empty");
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

it("returns each respiratory set to its own concept after retry, completion or early exit", async () => {
  const data = state();
  const ids = ["bicarbonate_compensation_respiratory_acidosis", "bicarbonate_compensation_respiratory_alkalosis"];
  data.catalogue = { ...catalogue, concepts: ids.map(id => ({
    ...catalogue.concepts[0], id, drillTarget: { drill: "compensation", rule: "respiratory" },
  })) };
  data.entries = ids.map(conceptId => ({ ...data.entries[0], conceptId }));
  const log = { data, loading: false, error: "", busy: false, refresh: vi.fn(), save: vi.fn(), review: vi.fn(),
    client: { list: vi.fn(), save: vi.fn(), review: vi.fn(), examples: vi.fn().mockResolvedValue({ examples: [], nextCursor: null }) } };
  const question = { values: [], numeric: { prompt: "Calculate", target: 10, tolerance: 0.1, decimals: 1, unit: "mmol/L", working: "10" } };
  const set = { help: { title: "Rule", formula: "Formula" }, questions: Array(5).fill(question) };
  const pending = deferred<typeof set>();
  const loader = vi.fn().mockReturnValueOnce(pending.promise).mockResolvedValue(set);
  const scroll = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  const render = (enabled: boolean) => act(async () => root.render(<ConnectedExamErrorLog log={log}
    loadDrill={enabled ? loader : undefined} pressureUnit="kPa" onBack={vi.fn()} onOpenExample={vi.fn()} />));
  await render(false);
  expect(container.querySelector("[data-practice]")).toBeNull();
  await render(true);
  for (const [index, id] of [...ids, ids[1]].entries()) {
    const row = container.querySelectorAll<HTMLButtonElement>(".exam-error-log__row")[ids.indexOf(id)];
    if (row.getAttribute("aria-expanded") !== "true") await act(async () => row.click());
    const button = container.querySelector<HTMLButtonElement>(`[data-practice="${id}"]`)!;
    await act(async () => { button.click(); button.click(); });
    if (!index) {
      expect(loader).toHaveBeenCalledTimes(1);
      await act(async () => pending.reject(new Error("Try again")));
      expect(button.closest("section")?.querySelector('[role="alert"]')).toBeTruthy();
      await act(async () => button.click());
    }
    expect(loader).toHaveBeenLastCalledWith({ drill: "compensation", rule: "respiratory", count: 5, pressureUnit: "kPa" }, expect.any(AbortSignal));
    if (index === 1) {
      for (let i = 0; i < 10; i++) {
        const input = container.querySelector<HTMLInputElement>('input[inputmode="decimal"]')!;
        await act(async () => {
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "10");
          input.dispatchEvent(new Event("input", { bubbles: true }));
        });
        await click("Check");
        await click(i % 5 === 4 ? "See summary" : "Next question");
        if (i === 4) await click("Practise another set");
      }
      await click("Back to Error Log");
      expect(document.activeElement).toBe(button);
      await act(async () => button.click());
    }
    if (index === 2) {
      data.entries = data.entries.filter(entry => entry.conceptId !== id);
      await render(true);
      await click("End drill");
      expect(container.querySelector('[aria-expanded="true"]')).toBeNull();
      expect(document.activeElement?.textContent).toMatch(/To review/);
      break;
    }
    await click("End drill");
    expect(document.activeElement).toBe(button);
    expect(row.getAttribute("aria-expanded")).toBe("true");
    expect(scroll).toHaveBeenCalledWith(0, window.scrollY);
  }
  scroll.mockRestore();
});

it("keeps saved concepts independent when they share a broad topic", async () => {
  const data = state();
  const ids = ["anion_gap_calculation_interpretation", "metabolic_acidosis_recognition", "delta_ratio_calculation_interpretation"];
  const labels = ["Anion gap calculation and interpretation", "Metabolic acidosis recognition", "Delta ratio calculation and interpretation"];
  data.catalogue = { ...catalogue, concepts: ids.map((id, index) => ({ ...catalogue.concepts[0], id, label: labels[index] })) };
  data.entries = ids.map((conceptId, index) => ({
    ...data.entries[0], conceptId, exampleCount: index === 1 ? 2 : 1,
    lastSavedAt: index === 1 ? "2026-10-08T01:00:00Z" : data.entries[0].lastSavedAt,
    status: index === 2 ? "archived" : "to_review", archivedAt: index === 2 ? "2026-10-09T01:00:00Z" : null,
  }));
  data.toReviewCount = 2;
  const examples = vi.fn(async (conceptId: string) => ({
    examples: Array.from({ length: conceptId === ids[1] ? 2 : 1 }, (_, i) => ({
      id: conceptId + i, attemptId: attempt, unitId: "EXAM-0001", partId: "part" + i,
      prompt: conceptId + " example " + i, questionNumber: i + 1, partNumber: 1, examKind: "mock" as const,
      finishedAt: data.entries[0].lastSavedAt, savedAt: data.entries[0].lastSavedAt,
    })), nextCursor: null,
  }));
  const log = { data, loading: false, error: "", busy: false, refresh: vi.fn(), save: vi.fn(), review: vi.fn(),
    client: { list: vi.fn(), save: vi.fn(), review: vi.fn(), examples } };
  const props = { log, onBack: vi.fn(), onOpenExample: vi.fn() };
  await act(async () => root.render(<ConnectedExamErrorLog {...props} />));
  const texts = (selector: string) => Array.from(container.querySelectorAll(selector), el => el.textContent);
  expect(texts(".exam-error-log__title strong")).toEqual([labels[1], labels[0]]);
  expect(texts(".exam-error-log__meta")).toEqual(["Acid–base", "Acid–base"]);
  expect(texts(".exam-error-log__count > span").map(value => parseInt(value!, 10))).toEqual([2, 1]);
  expect(texts(".exam-error-log__topic-label")).toEqual(["Acid–base2"]);
  expect(examples.mock.calls.map(([id]) => id)).toEqual([ids[1]]);
  expect(texts(".exam-error-log__example-copy > span")).toEqual([ids[1] + " example 0", ids[1] + " example 1"]);
  await act(async () => container.querySelectorAll<HTMLButtonElement>(".exam-error-log__row")[1].click());
  expect(examples.mock.calls.map(([id]) => id)).toEqual([ids[1], ids[0]]);
  expect(texts(".exam-error-log__expanded:not([hidden]) .exam-error-log__example-copy > span")).toEqual([ids[0] + " example 0"]);
  await click("Archived 1");
  expect(texts(".exam-error-log__title strong")).toEqual([labels[2]]);
  expect(log.review).not.toHaveBeenCalled();
});
