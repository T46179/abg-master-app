import type { RuntimeCall } from "./examRuntime";
import type { ErrorLogExamplePage, ErrorLogState } from "../presentation/exam/errorLogTypes";

const object = (value: unknown): value is Record<string, any> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const date = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value));
const id = (value: unknown) => typeof value === "string" && /^[a-z][a-z0-9_]*$/.test(value);
const uuid = (value: unknown) => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const text = (value: unknown) => typeof value === "string" && Boolean(value.trim());

export function verifyErrorLogState(value: unknown): ErrorLogState {
  if (!object(value) || !object(value.catalogue) || !Array.isArray(value.catalogue.topics) || !Array.isArray(value.catalogue.concepts)
    || value.catalogue.topics.some((t: any) => !object(t) || !id(t.id) || !text(t.label))
    || value.catalogue.concepts.some((c: any) => !object(c) || !id(c.id) || !text(c.label) || !text(c.errorType)
      || typeof c.active !== "boolean" || !value.catalogue.topics.some((t: any) => t.id === c.topicId))
    || !Array.isArray(value.entries) || value.entries.some((e: any) => !object(e) || !id(e.conceptId)
      || !["to_review", "archived"].includes(e.status) || !date(e.createdAt) || !date(e.lastSavedAt)
      || (e.archivedAt !== null && !date(e.archivedAt)) || (e.reopenedAt !== null && !date(e.reopenedAt))
      || (e.status === "archived" ? e.archivedAt === null || e.reopenedAt !== null : e.archivedAt !== null)
      || !Number.isInteger(e.exampleCount) || e.exampleCount < 1 || !value.catalogue.concepts.some((c: any) => c.id === e.conceptId))
    || (value.attemptId !== null && !uuid(value.attemptId)) || !object(value.savedSources)
    || Object.values(value.savedSources).some(ids => !Array.isArray(ids) || new Set(ids).size !== ids.length
      || ids.some(v => !id(v) || !value.entries.some((e: any) => e.conceptId === v)))
    || (value.attemptId === null && Object.keys(value.savedSources).length > 0)
    || value.toReviewCount !== value.entries.filter((e: any) => e.status === "to_review").length
    || new Set(value.catalogue.concepts.map((c: any) => c.id)).size !== value.catalogue.concepts.length
    || new Set(value.catalogue.topics.map((t: any) => t.id)).size !== value.catalogue.topics.length
    || new Set(value.entries.map((e: any) => e.conceptId)).size !== value.entries.length) {
    throw new Error("Couldn’t verify the Error log response. Please retry.");
  }
  return value as ErrorLogState;
}

export function errorLogClient(call: RuntimeCall) {
  return {
    async list(attemptId?: string) {
      const result = verifyErrorLogState(await call("error_log_list", attemptId ? { attemptId } : {}));
      if (result.attemptId !== (attemptId ?? null)) throw new Error("Error log response belongs to another attempt.");
      return result;
    },
    async save(attemptId: string, partId: string, conceptIds: string[]) {
      const raw = await call<unknown>("error_log_save", { attemptId, partId, conceptIds });
      const result = verifyErrorLogState(raw);
      if (result.attemptId !== attemptId || !object(raw) || !Array.isArray(raw.savedConceptIds)
        || raw.savedConceptIds.length !== conceptIds.length || !conceptIds.every(c => raw.savedConceptIds.includes(c) && result.savedSources[partId]?.includes(c))) {
        throw new Error("Couldn’t confirm the save. Please retry.");
      }
      return result;
    },
    async review(conceptId: string, archive: boolean) {
      const result = verifyErrorLogState(await call(archive ? "error_log_archive" : "error_log_restore", { conceptId }));
      if (!result.entries.some(e => e.conceptId === conceptId && e.status === (archive ? "archived" : "to_review"))) throw new Error("Couldn’t confirm the review state. Please retry.");
      return result;
    },
    async examples(conceptId: string, cursor?: ErrorLogExamplePage["nextCursor"]) {
      const raw = await call<unknown>("error_log_examples", { conceptId, ...(cursor ? { cursor } : {}) });
      if (!object(raw) || !Array.isArray(raw.examples) || raw.examples.length > 20
        || raw.examples.some((e: any) => !object(e) || !uuid(e.id) || !uuid(e.attemptId) || !text(e.unitId) || !text(e.partId)
          || typeof e.prompt !== "string" || !Number.isInteger(e.questionNumber) || e.questionNumber < 1
          || !Number.isInteger(e.partNumber) || e.partNumber < 1 || !["mock", "custom"].includes(e.examKind) || !date(e.finishedAt) || !date(e.savedAt))
        || (raw.nextCursor !== null && (!object(raw.nextCursor) || !uuid(raw.nextCursor.id) || !date(raw.nextCursor.savedAt)))) {
        throw new Error("Couldn’t load the saved examples. Please retry.");
      }
      return raw as ErrorLogExamplePage;
    },
  };
}
