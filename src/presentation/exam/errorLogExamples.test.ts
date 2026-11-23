import { expect, it, vi } from "vitest";
import type { errorLogClient } from "../../core/examErrorLog";
import type { ErrorLogEntry, ErrorLogExamplePage } from "./errorLogTypes";
import { examplesFor } from "./errorLogExamples";

it("retains unchanged concepts across archive and discards superseded example responses", async () => {
  const empty: ErrorLogExamplePage = { examples: [], nextCursor: null };
  let finish!: (page: ErrorLogExamplePage) => void;
  const delayed = new Promise<ErrorLogExamplePage>(resolve => { finish = resolve; });
  const client = { list: vi.fn(), save: vi.fn(), review: vi.fn(), examples: vi.fn().mockResolvedValue(empty) } satisfies ReturnType<typeof errorLogClient>;
  const cache = examplesFor(client);
  const entry: ErrorLogEntry = { conceptId: "first", status: "to_review", lastSavedAt: "2026-11-01T00:00:00Z",
    createdAt: "2026-10-01T00:00:00Z", exampleCount: 1, archivedAt: null, reopenedAt: null };
  const other = { ...entry, conceptId: "second" };
  cache.reconcile([entry, other]);
  await cache.load("second");
  client.examples.mockReturnValueOnce(delayed);
  const oldRequest = cache.load("first");
  cache.reconcile([{ ...entry, lastSavedAt: "2026-11-02T00:00:00Z" },
    { ...other, status: "archived", archivedAt: "2026-11-02T01:00:00Z" }]);
  expect(cache.snapshot().first).toBeUndefined();
  expect(cache.snapshot().second).toEqual(empty);
  await cache.load("first");
  finish({ examples: [], nextCursor: { id: "obsolete", savedAt: entry.lastSavedAt } });
  await oldRequest;
  expect(cache.snapshot().first).toEqual(empty);
  expect(client.examples).toHaveBeenCalledTimes(3);
});
