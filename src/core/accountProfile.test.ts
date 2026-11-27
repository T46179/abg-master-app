// @vitest-environment jsdom
import type { SupabaseClient } from "@supabase/supabase-js";
import { expect, it, vi } from "vitest";
import { preferredNameStore, signInMethods } from "./accountProfile";

const writer = vi.hoisted(() => ({ setSession: vi.fn(), updateUser: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ auth: writer }) }));
const owner = { auth: { getSession: async () => ({ data: { session: { user: { id: "a" }, access_token: "token", refresh_token: "refresh" } } }) } } as SupabaseClient;
const store = (id: string, metadata: boolean) => preferredNameStore("https://example.test", id, "key", owner, metadata);

it("sends only preferred-name metadata for saves and removal and keeps failures out of local storage", async () => {
  writer.setSession.mockResolvedValue({ data: { user: { id: "a" } } });
  writer.updateUser.mockResolvedValue({ data: { user: { id: "a" } } });
  await store("a", true).save("  Thanh ");
  expect(writer.updateUser).toHaveBeenLastCalledWith({ data: { preferred_name: "Thanh" } });
  await store("a", true).save("");
  expect(writer.updateUser).toHaveBeenLastCalledWith({ data: { preferred_name: null } });
  writer.updateUser.mockResolvedValue({ error: true });
  await expect(store("a", true).save("retry")).rejects.toThrow();
  expect(store("a", false).read({})).toBe("");
  await expect(store("wrong", true).save("changed")).rejects.toThrow();
});

it("isolates local preferred names by owner, supports clearing and checks length", async () => {
  await store("a", false).save("  Taylor ");
  expect(store("a", false).read({})).toBe("Taylor");
  expect(store("b", false).read({})).toBe("");
  await expect(store("a", false).save("x".repeat(41))).rejects.toThrow();
  await store("a", false).save(" ");
  expect(store("a", false).read({})).toBe("");
});

it.each([
  [false, true, "No password configured", "Connected"],
  [false, false, "No password configured", "Not connected"],
  [true, true, "Password enabled", "Connected"],
  [true, false, "Password enabled", "Not connected"],
  [null, null, "Unknown", "Unknown"]
] as const)("describes password=%s google=%s", (password, google, passLabel, googleLabel) => {
  expect(signInMethods(password, google)).toEqual({ password: passLabel, google: googleLabel });
});
