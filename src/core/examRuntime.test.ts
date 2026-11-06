import { expect, it, vi } from "vitest";
import { ExamRuntimeSession, ExamRuntimeError, encodeAnswers, runtimeCall, toSitting, type ExamNavigationPosition, type RuntimeAttempt, type RuntimeCall } from "./examRuntime";
import type { SupabaseClient } from "@supabase/supabase-js";

it.each([
 { error: { name: "FunctionsFetchError" }, transport: true, code: "EXAM_UNAVAILABLE" },
 { error: new Error("unknown failure"), transport: false, code: "EXAM_UNAVAILABLE" },
 { error: { name: "FunctionsHttpError", context: { json: async () => ({ code: "EXAM_UNAVAILABLE" }) } }, transport: false, code: "EXAM_UNAVAILABLE" },
 { error: { name: "FunctionsHttpError", context: { json: async () => ({ code: "EXAM_LOCAL_CONFLICT" }) } }, transport: false, code: "EXAM_LOCAL_CONFLICT" },
])("marks only identifiable transport failures: $code ($transport)", async ({ error, transport, code }) => {
 const client = { functions: { invoke: vi.fn().mockResolvedValue({ error }) } } as unknown as SupabaseClient;
 await expect(runtimeCall(client)("read", {})).rejects.toMatchObject({ code, transportFailure: transport });
});
const base = (): RuntimeAttempt => ({ id: "attempt", status: "active", revision: 0, pressureUnit: "kPa", createdAt: "2026-09-29T00:00:00Z", presentedAt: null, finishedAt: null, answers: {}, questions: [{ id: "unit", tables: [], parts: [{ id: "number", kind: "numeric", prompt: "Value", marks: 1, pressureAnswer: true }, { id: "text", kind: "concept", prompt: "Explain", marks: 2 }] }] });
function harness() {
  const entries = new Map<string, string>();
  const storage = { getItem: (k: string) => entries.get(k) ?? null, setItem: (k: string, v: string) => { entries.set(k, v); }, removeItem: (k: string) => { entries.delete(k); } };
  let server = base();
  const invoke = vi.fn(async (operation: string, input: Record<string, unknown>) => {
    if (operation === "save" || operation === "present" || operation === "claim") {
      if (input.revision !== server.revision) throw new Error("stale");
      server = { ...server, revision: server.revision + 1, answers: operation === "save" ? input.answers as RuntimeAttempt["answers"] : server.answers };
    }
    if (operation === "submit") server = { ...server, status: "submitted", answers: input.answers as RuntimeAttempt["answers"] };
    return structuredClone(server);
  });
  const call = invoke as RuntimeCall;
  return { entries, storage, invoke, call, session: new ExamRuntimeSession(call, storage, "owner") };
}
it("preserves raw numeric text and frozen pressure unit without reshuffling", () => {
  const attempt = base(); attempt.answers = { number: { text: "  5.00 ", unit: "kPa" }, text: " raw " };
  const sitting = toSitting(attempt);
  expect(sitting.questions).toBe(attempt.questions);
  expect(sitting.answers).toEqual({ number: "  5.00 ", text: " raw " });
  expect(encodeAnswers(sitting)).toEqual(attempt.answers);
});
it("restores question and remembered parts by identifier after reordering, including review", () => {
 const attempt = base();
 attempt.questions.push({ id: "later", tables: [], parts: [{ id: "later-a", kind: "concept", prompt: "A", marks: 1 }, { id: "later-b", kind: "concept", prompt: "B", marks: 1 }] });
 const position: ExamNavigationPosition = { questionId: "later", partIdsByQuestion: { unit: "text", later: "later-b" }, phase: "review" };
 expect(toSitting(attempt, position)).toMatchObject({ questionIndex: 1, partIndices: { unit: 1, later: 1 }, phase: "review" });
 attempt.questions.reverse(); attempt.questions[0].parts.reverse();
 expect(toSitting(attempt, position)).toMatchObject({ questionIndex: 0, partIndices: { unit: 1, later: 0 }, phase: "review" });
});
it.each([
 undefined, null, [], "invalid", 12,
 { questionId: "missing", partIdsByQuestion: { unit: "missing" }, phase: "invalid" },
 { questionId: "unit", partIdsByQuestion: null },
 { questionId: "unit", partIdsByQuestion: ["text"] },
 { questionId: 5, partIdsByQuestion: { unit: {} } },
])("safely defaults missing or malformed navigation: %j", position => {
 const attempt = base(); attempt.answers.text = "preserved";
 expect(toSitting(attempt, position as unknown as ExamNavigationPosition)).toMatchObject({ questionIndex: 0, partIndices: {}, phase: "active", answers: { text: "preserved" } });
});
it("ignores stored review navigation when the server attempt is submitted", () => {
 expect(toSitting({ ...base(), status: "submitted" }, { questionId: "unit", partIdsByQuestion: { unit: "text" }, phase: "review" }))
  .toMatchObject({ phase: "complete", questionIndex: 0, partIndices: {} });
});
it("persists navigation without remote calls and preserves answers and recovery fields through acknowledgements", async () => {
 const h = harness(); await h.session.start("kPa"); h.session.stage({ text: "draft" });
 const before = JSON.parse(h.entries.get("owner")!);
 const sitting = { ...toSitting(base()), partIndices: { unit: 1 }, phase: "review" as const };
 h.session.setNavigation(sitting);
 expect(h.invoke.mock.calls.map(c => c[0])).toEqual(["start"]);
 expect(JSON.parse(h.entries.get("owner")!)).toMatchObject({ ...before, navigation: { questionId: "unit", partIdsByQuestion: { unit: "text" }, phase: "review" } });
 await h.session.save(); await h.session.present("unit");
 const restored = new ExamRuntimeSession(h.call, h.storage, "owner"); await restored.recover();
 expect(toSitting(restored.attempt!, restored.journal?.navigation)).toMatchObject({ phase: "review", partIndices: { unit: 1 }, answers: { text: "draft" } });
});
it("retains the last persisted position when a navigation write fails and keeps answer persistence usable", async () => {
 const h = harness(); await h.session.start("kPa");
 const original = h.storage.setItem;
 h.session.setNavigation(toSitting(base()));
 h.session.stage({ text: "before" });
 const before = h.entries.get("owner");
 h.storage.setItem = () => { throw new Error("quota"); };
 expect(() => h.session.setNavigation({ ...toSitting(base()), partIndices: { unit: 1 }, phase: "review" })).not.toThrow();
 expect(h.entries.get("owner")).toBe(before);
 expect(h.session.journal?.navigation?.phase).toBe("active");
 expect(h.session.journal?.dirty).toEqual({ text: "before" });
 h.storage.setItem = original;
 h.session.stage({ text: "after" }); await h.session.save();
 const restored = new ExamRuntimeSession(h.call, h.storage, "owner"); await restored.recover();
 expect(toSitting(restored.attempt!, restored.journal?.navigation)).toMatchObject({ phase: "active", partIndices: { unit: 0 }, answers: { text: "after" } });
});
it("does not create navigation when optional persistence fails and keeps journals account isolated", async () => {
 const h = harness(); await h.session.start("kPa");
 const original = h.storage.setItem;
 h.storage.setItem = () => { throw new Error("quota"); };
 h.session.setNavigation({ ...toSitting(base()), partIndices: { unit: 1 } });
 expect(h.session.journal?.navigation).toBeUndefined();
 h.storage.setItem = original;
 const restored = new ExamRuntimeSession(h.call, h.storage, "owner"); await restored.recover();
 expect(toSitting(restored.attempt!, restored.journal?.navigation)).toMatchObject({ questionIndex: 0, partIndices: {} });
 expect(new ExamRuntimeSession(h.call, h.storage, "another-owner").journal).toBeNull();
});
it("retains submission identity with navigation and clears navigation with the existing journal lifecycle", async () => {
 const h = harness(); await h.session.start("kPa");
 h.session.setNavigation({ ...toSitting(base()), phase: "review" });
 h.invoke.mockRejectedValueOnce(new Error("lost"));
 await expect(h.session.submit({ text: "frozen" })).rejects.toThrow();
 const submission = h.session.journal!.submission;
 h.session.setNavigation(toSitting(base()));
 expect(JSON.parse(h.entries.get("owner")!).submission).toEqual(submission);
 await h.session.abandon("attempt");
 expect(h.entries.has("owner")).toBe(false);
 await h.session.start("kPa"); expect(h.session.journal?.navigation).toBeUndefined();
 h.session.clear(); expect(h.entries.has("owner")).toBe(false);
});
it("persists start identity before a lost response and retries the same request", async () => {
  const h = harness(); h.invoke.mockRejectedValueOnce(new Error("offline"));
  await expect(h.session.start("kPa")).rejects.toThrow();
  const restored = new ExamRuntimeSession(h.call, h.storage, "owner");
  await restored.start("mmHg");
  expect(h.invoke.mock.calls[1][1]).toMatchObject({ requestId: h.invoke.mock.calls[0][1].requestId, recoveryKey: h.invoke.mock.calls[0][1].recoveryKey, pressureUnit: "kPa" });
  expect(restored.writerId).not.toBe(h.session.writerId);
});
it("serializes presentation and autosaves using acknowledged revisions", async () => {
  const h = harness(); await h.session.start("kPa");
  h.session.stage({ text: "first" });
  const save = h.session.save(); const present = h.session.present("unit");
  await Promise.all([save, present]);
  expect(h.invoke.mock.calls.map(c => [c[0], c[1].revision])).toEqual([["start", undefined], ["save", 0], ["present", 1]]);
});
it("does not erase a later edit when an earlier save completes", async () => {
  const h = harness(); await h.session.start("kPa");
  let resolve!: (value: RuntimeAttempt) => void;
  h.invoke.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
  h.session.stage({ text: "first" }); const pending = h.session.save(); await Promise.resolve();
  h.session.stage({ text: "second" }); resolve({ ...base(), revision: 1 }); await pending;
  expect(h.session.journal?.dirty).toEqual({ text: "second" });
});
it("keeps exact submission after a lost response across reload", async () => {
  const h = harness(); await h.session.start("kPa");
  h.invoke.mockRejectedValueOnce(new Error("lost response"));
  await expect(h.session.submit({ text: " first " })).rejects.toThrow();
  const original = h.session.journal!.submission;
  const restored = new ExamRuntimeSession(h.call, h.storage, "owner"); await restored.recover();
  await restored.submit({ text: "replacement" });
  expect(h.invoke.mock.calls.at(-1)![1]).toMatchObject(original!);
  expect(restored.journal?.submission).toBeUndefined();
});
it("blocks local edits while submission is uncertain", async () => {
  const h = harness(); await h.session.start("kPa"); h.invoke.mockRejectedValueOnce(new Error("offline"));
  await expect(h.session.submit({})).rejects.toThrow();
  expect(() => h.session.stage({ text: "changed" })).toThrow("EXAM_SUBMISSION_PENDING");
});
it("preserves conflicting unsent answers and requires an explicit server-draft choice", async () => {
  const h = harness(); await h.session.start("kPa"); h.session.stage({ text: "local" });
  h.invoke.mockResolvedValueOnce({ ...base(), revision: 4, answers: { text: "other tab" } });
  await expect(h.session.recover()).rejects.toThrow("EXAM_LOCAL_CONFLICT");
  expect(h.session.journal?.dirty).toEqual({ text: "local" });
  h.session.keepServerDraft();
  expect(JSON.parse(h.entries.get("owner-conflict-backup")!).dirty.text).toBe("local");
});
it("does not start a remote attempt if browser persistence fails", async () => {
  const h = harness(); h.storage.setItem = () => { throw new Error("quota"); };
  await expect(h.session.start("kPa")).rejects.toThrow("quota");
  expect(h.invoke).not.toHaveBeenCalled();
});
it("submitted recovery does not claim a writer or regrade", async () => {
  const h = harness(); await h.session.start("kPa"); await h.session.submit({ text: "x" });
  h.invoke.mockClear(); await h.session.recover();
  expect(h.invoke.mock.calls.map(c => c[0])).toEqual(["read"]);
});

it("freezes Custom configuration before a lost start acknowledgement and ignores later preferences", async () => {
  const h = harness(); h.invoke.mockRejectedValueOnce(new Error("lost"));
  await expect(h.session.start("kPa", { examKind: "custom", excludedCategories: ["mechanical_ventilation", "toxicology_management", "mechanical_ventilation"] })).rejects.toThrow();
  const stored = JSON.parse(h.entries.get("owner")!);
  expect(stored).toMatchObject({ examKind: "custom", excludedCategories: ["mechanical_ventilation", "toxicology_management"] });
  const reloaded = new ExamRuntimeSession(h.call, h.storage, "owner");
  await reloaded.start("mmHg", { examKind: "mock", excludedCategories: [] });
  expect(h.invoke.mock.calls.at(-1)![1]).toMatchObject({ requestId: stored.requestId, pressureUnit: "kPa", examKind: "custom", excludedCategories: stored.excludedCategories });
});
it("recovers a legacy pending-start journal as Mock", async () => {
  const h = harness(); h.entries.set("owner", JSON.stringify({ requestId: "old", recoveryKey: "key", pressureUnit: "kPa" }));
  const reloaded = new ExamRuntimeSession(h.call, h.storage, "owner"); await reloaded.recover();
  expect(h.invoke.mock.calls[0][1]).toMatchObject({ examKind: "mock", excludedCategories: [] });
});

it("allows a new setup after a definite configuration rejection without discarding uncertain requests", async () => {
  const h = harness(); h.invoke.mockRejectedValueOnce(new ExamRuntimeError("EXAM_INVALID_CONFIGURATION"));
  await expect(h.session.start("kPa", { examKind: "custom", excludedCategories: ["retired"] })).rejects.toThrow("EXAM_INVALID_CONFIGURATION");
  expect(h.session.journal).toBeNull(); expect(h.entries.has("owner")).toBe(false);
  await h.session.start("kPa");
  expect(h.invoke.mock.calls.at(-1)![1]).toMatchObject({ examKind: "mock", excludedCategories: [] });
});

it("retains selected count and display settings across an uncertain start and recovery", async () => {
 const h=harness();h.invoke.mockRejectedValueOnce(new Error("offline"));
 await expect(h.session.start("kPa",{examKind:"mock",excludedCategories:[],unitCount:5,showTimer:false,showRanges:false})).rejects.toThrow();
 const restored=new ExamRuntimeSession(h.call,h.storage,"owner");await restored.start("mmHg",{examKind:"custom",excludedCategories:[],unitCount:3});
 expect(h.invoke.mock.calls[1][1]).toMatchObject({unitCount:5,examKind:"mock",pressureUnit:"kPa"});
 expect(restored.journal).toMatchObject({showTimer:false,showRanges:false});
 restored.setDisplayPreferences(true,false);expect(JSON.parse(h.entries.get("owner")!)).toMatchObject({showTimer:true,showRanges:false});
});

it('preserves trial purpose after a lost start and reload', async () => {
 const h=harness(); h.invoke.mockRejectedValueOnce(new Error('offline'));
 await expect(h.session.start('kPa',{purpose:'trial',examKind:'mock',unitCount:3,excludedCategories:[]})).rejects.toThrow();
 const restored=new ExamRuntimeSession(h.call,h.storage,'owner'); await restored.recover();
 expect(h.invoke.mock.calls.filter(c=>c[0]==='start').map(c=>c[1].purpose)).toEqual(['trial','trial']);
 expect(h.invoke.mock.calls[1][1].requestId).toBe(h.invoke.mock.calls[0][1].requestId);
});
it.each(['EXAM_TRIAL_DISABLED','EXAM_TRIAL_CONFIGURATION'])('clears a definitively uncreated trial on %s', async code=>{
 const h=harness(); h.invoke.mockRejectedValueOnce(new ExamRuntimeError(code));
 await expect(h.session.start('kPa',{purpose:'trial',examKind:'mock',unitCount:3,excludedCategories:[]})).rejects.toThrow();
 expect(h.session.journal).toBeNull(); expect(h.entries.has('owner')).toBe(false);
});
