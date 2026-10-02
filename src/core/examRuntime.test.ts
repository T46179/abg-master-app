import { expect, it, vi } from "vitest";
import { ExamRuntimeSession, encodeAnswers, toSitting, type RuntimeAttempt, type RuntimeCall } from "./examRuntime";
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
