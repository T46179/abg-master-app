import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient, loadRuntimeConfig, query } = vi.hoisted(() => {
  const query = { from: vi.fn(), select: vi.fn(), eq: vi.fn(), abortSignal: vi.fn(), maybeSingle: vi.fn() };
  return { createClient: vi.fn(() => query), loadRuntimeConfig: vi.fn(), query };
});
vi.mock("@supabase/supabase-js", () => ({ createClient }));
vi.mock("./runtime", () => ({ loadRuntimeConfig }));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  loadRuntimeConfig.mockResolvedValue({ SUPABASE_URL: "https://example.supabase.co", SUPABASE_ANON_KEY: "public-key" });
  for (const key of ["from", "select", "eq", "abortSignal"] as const) query[key].mockReturnValue(query);
});

describe("public cases-solved metric", () => {
  it("uses a session-free public client and only reads the aggregate", async () => {
    query.maybeSingle.mockResolvedValue({ data: { metric_value: "1085" }, error: null });
    const { loadPublicCasesSolvedCount } = await import("./publicSiteMetrics");
    const signal = new AbortController().signal;
    expect(await loadPublicCasesSolvedCount(signal)).toBe(1085);
    expect(createClient).toHaveBeenCalledWith("https://example.supabase.co", "public-key", {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: "abgmaster-public-site-metrics" }
    });
    expect(query.from.mock.calls).toEqual([["public_site_metrics"]]);
    expect(query.eq).toHaveBeenCalledWith("metric_key", "cases_solved");
    expect(query.abortSignal).toHaveBeenCalledWith(signal);
  });

  it.each([null, undefined, "", " ", -1, 1.5, "invalid", false])("does not present invalid metric %s as a count", async value => {
    query.maybeSingle.mockResolvedValue({ data: { metric_value: value }, error: null });
    const { loadPublicCasesSolvedCount } = await import("./publicSiteMetrics");
    expect(await loadPublicCasesSolvedCount(new AbortController().signal)).toBeNull();
  });

  it("shares one public client across simultaneous mounts", async () => {
    query.maybeSingle.mockResolvedValue({ data: { metric_value: 1085 }, error: null });
    const { loadPublicCasesSolvedCount } = await import("./publicSiteMetrics");
    const signal = new AbortController().signal;
    expect(await Promise.all([loadPublicCasesSolvedCount(signal), loadPublicCasesSolvedCount(signal)])).toEqual([1085, 1085]);
    expect(createClient).toHaveBeenCalledTimes(1);
  });

  it("accepts a genuine zero", async () => {
    query.maybeSingle.mockResolvedValue({ data: { metric_value: 0 }, error: null });
    const { loadPublicCasesSolvedCount } = await import("./publicSiteMetrics");
    expect(await loadPublicCasesSolvedCount(new AbortController().signal)).toBe(0);
  });

  it("does not fall back to attempts on query failure", async () => {
    query.maybeSingle.mockResolvedValue({ data: null, error: { message: "unavailable" } });
    const { loadPublicCasesSolvedCount } = await import("./publicSiteMetrics");
    expect(await loadPublicCasesSolvedCount(new AbortController().signal)).toBeNull();
    expect(query.from.mock.calls).toEqual([["public_site_metrics"]]);
  });
});
