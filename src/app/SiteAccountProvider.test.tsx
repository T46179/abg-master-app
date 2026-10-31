// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SiteAccountProvider, useSiteAccount } from "./SiteAccountProvider";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
function Consumer({ area }: { area: string }) {
  const { identity } = useSiteAccount();
  return <p data-area={area}>{identity.status}:{identity.userId ?? "none"}</p>;
}

describe("shared account context", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  beforeEach(() => { vi.useFakeTimers(); container = document.createElement("div"); document.body.append(container); root = createRoot(container); });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.useRealTimers(); });

  it("gives separate app areas the same verified identity and clears both on sign-out", async () => {
    let changed: (event: string, session: null) => void = () => undefined;
    const unsubscribe = vi.fn();
    const client = { auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: "learner" } } }, error: null }),
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "learner", is_anonymous: false, email: "learner@example.test", email_confirmed_at: "confirmed" } }, error: null }),
      onAuthStateChange: vi.fn().mockImplementation(callback => { changed = callback; return { data: { subscription: { unsubscribe } } }; })
    } };
    await act(async () => root.render(<SiteAccountProvider client={client as unknown as SupabaseClient}><Consumer area="practice" /><Consumer area="exam" /></SiteAccountProvider>));
    expect(container.querySelector('[data-area="practice"]')?.textContent).toBe("verified:learner");
    expect(container.querySelector('[data-area="exam"]')?.textContent).toBe("verified:learner");
    expect(client.auth.onAuthStateChange).toHaveBeenCalledTimes(1);
    await act(async () => changed("SIGNED_OUT", null));
    expect(container.querySelector('[data-area="practice"]')?.textContent).toBe("signed_out:none");
    expect(container.querySelector('[data-area="exam"]')?.textContent).toBe("signed_out:none");
    await act(async () => root.unmount());
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
