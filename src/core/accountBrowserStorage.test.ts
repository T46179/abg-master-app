import { describe, expect, it } from "vitest";
import { createAccountBrowserStorage } from "./accountBrowserStorage";
import { createMemoryStorage } from "./storage";

const staging = "https://staging.supabase.co";
const production = "https://production.supabase.co";

describe("account-owned browser storage", () => {
  it("isolates accounts, environments and guest identities", () => {
    const base = createMemoryStorage();
    const a = createAccountBrowserStorage(base, staging, "a").storage;
    const b = createAccountBrowserStorage(base, staging, "b").storage;
    const prod = createAccountBrowserStorage(base, production, "a").storage;
    a.setItem("progress", "A"); b.setItem("progress", "B"); prod.setItem("progress", "PROD");
    expect(a.getItem("progress")).toBe("A");
    expect(b.getItem("progress")).toBe("B");
    expect(prod.getItem("progress")).toBe("PROD");
    a.removeItem("progress");
    expect(b.getItem("progress")).toBe("B");
    expect(prod.getItem("progress")).toBe("PROD");
  });
  it("retains the same storage after upgrading a guest without changing its ID", () => {
    const base = createMemoryStorage();
    createAccountBrowserStorage(base, staging, "same-id").storage.setItem("progress", "saved");
    expect(createAccountBrowserStorage(base, staging, "same-id").storage.getItem("progress")).toBe("saved");
  });
  it("does not silently adopt or erase unowned legacy progress", () => {
    const base = createMemoryStorage(); base.setItem("abgmaster_userState", "legacy");
    const account = createAccountBrowserStorage(base, staging, "new-account");
    expect(account.storage.getItem("abgmaster_userState")).toBeNull();
    account.storage.removeItem("abgmaster_userState");
    expect(base.getItem("abgmaster_userState")).toBe("legacy");
  });
  it("disables old async writes without deleting saved data", () => {
    const base = createMemoryStorage();
    const previous = createAccountBrowserStorage(base, staging, "a");
    previous.storage.setItem("progress", "saved"); previous.deactivate();
    previous.storage.setItem("progress", "late write"); previous.storage.removeItem("progress");
    expect(previous.storage.getItem("progress")).toBeNull();
    expect(createAccountBrowserStorage(base, staging, "a").storage.getItem("progress")).toBe("saved");
  });
  it("blocks writes immediately on identity change, before React unmounts", () => {
    const base = createMemoryStorage(); let current = true;
    const previous = createAccountBrowserStorage(base, staging, "a", () => current);
    previous.storage.setItem("draft", "original"); current = false;
    previous.storage.setItem("draft", "late response"); previous.storage.removeItem("draft");
    expect(previous.storage.getItem("draft")).toBeNull();
    expect(createAccountBrowserStorage(base, staging, "a").storage.getItem("draft")).toBe("original");
  });
  it("rejects missing owners and credential-bearing project URLs", () => {
    const base = createMemoryStorage();
    expect(() => createAccountBrowserStorage(base, staging, " ")).toThrow();
    expect(() => createAccountBrowserStorage(base, "https://secret@staging.supabase.co", "a")).toThrow();
    expect(() => createAccountBrowserStorage(base, "http://staging.supabase.co", "a")).toThrow();
  });
});
