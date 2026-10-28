import { afterEach, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { submitProtectedPracticeCase } from "./protectedPractice";
const config = { SUPABASE_URL: "https://example.supabase.co", SUPABASE_ANON_KEY: "anon" };
const client = { auth: { getSession: async () => ({ data: { session: { access_token: "jwt" } } }) } } as unknown as SupabaseClient;
const input = { caseToken: "token", answers: [], elapsedSeconds: 1, timedMode: false, clientCompletedAt: "2026-10-28T00:00:00Z" };
afterEach(() => vi.unstubAllGlobals());
it("uses only submission-only API and accepts a result without a replacement", async () => {
  const fetch = vi.fn(async (_url: string, _options?: RequestInit) => new Response(JSON.stringify({ summary: { caseId: "case", caseData: {} }, stepResults: [], explanation: { overview: "done" } }), { status: 200 }));
  vi.stubGlobal("fetch", fetch);
  const result = await submitProtectedPracticeCase(config, client, input);
  expect(fetch.mock.calls[0]?.[0]).toBe("https://example.supabase.co/functions/v1/submit-practice-result");
  expect(result.summary.caseId).toBe("case");
  expect(result).not.toHaveProperty("replacementSlot");
});
it("does not fall back to legacy submission when the new endpoint fails", async () => {
  const fetch = vi.fn(async (_url: string, _options?: RequestInit) => new Response(JSON.stringify({ recoverable: true }), { status: 503 }));
  vi.stubGlobal("fetch", fetch);
  await expect(submitProtectedPracticeCase(config, client, input)).rejects.toMatchObject({ status: 503 });
  expect(fetch).toHaveBeenCalledTimes(1);
});
