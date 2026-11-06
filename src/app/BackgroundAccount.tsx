import { memo, useLayoutEffect, useState, type ReactNode } from "react";
import { AccountLoadingContext } from "./AccountLoading";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AppProvider, AppStateProvider, useAppContext, type AppContextValue } from "./AppProvider";
import { AccountWorkspaceProvider, AccountWorkspaceContextProvider, useOptionalAccountWorkspace, type AccountWorkspace } from "./AccountWorkspace";
import { useSiteAccount } from "./SiteAccountProvider";
import { initialAppState } from "./state";
import { createMemoryStorage } from "../core/storage";
import type { RuntimeConfig } from "../core/types";

const empty: AppContextValue = {
  state: initialAppState, setUserState: async () => {}, patchSessionState: () => {},
  patchPracticeState: () => {}, retryPendingSubmissionNow: () => {}, discardPendingSubmission: () => {},
  saveLocalCalibrationCompletion: async () => {}, skipCalibrationOnboarding: async () => {}
};
type Published = { workspace: AccountWorkspace; app: AppContextValue };

function Publish({ publish }: { publish: (value: Published) => void }) {
  const app = useAppContext();
  const workspace = useOptionalAccountWorkspace()!;
  useLayoutEffect(() => { publish({ workspace, app }); }, [app, workspace, publish]);
  return null;
}
const OwnedRuntime = memo(function OwnedRuntime({ client, config, loadPayload, publish }: {
  client: SupabaseClient; config: RuntimeConfig; loadPayload: AccountWorkspace["loadPayload"]; publish: (value: Published) => void;
}) {
  return <AccountWorkspaceProvider canonical={client} config={config} loadPayload={loadPayload}>
    <AppProvider><Publish publish={publish} /></AppProvider>
  </AccountWorkspaceProvider>;
});

/** Keep the router/public UI stable while the owned runtime is replaced. */
export function BackgroundAccount({ client, config, loadPayload, children }: {
  client: SupabaseClient; config: RuntimeConfig; loadPayload: AccountWorkspace["loadPayload"]; children: ReactNode;
}) {
  const { identity, account } = useSiteAccount();
  const [published, publish] = useState<Published | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [memory] = useState(createMemoryStorage);
  const eligible = identity.status !== "checking";
  const current = eligible && published?.workspace.userId === identity.userId && published.workspace.isCurrent() ? published : null;
  const ready = Boolean(current && current.app.state.status === "ready");
  const fallback: AccountWorkspace = { userId: null, runtimeConfig: config, client: null, browserStorage: memory, isCurrent: () => false };
  return <AccountLoadingContext.Provider value={{ ready, error: identity.status === "unavailable", attempt,
    retry: () => { setAttempt(n => n + 1); void account.retryVerification(); } }}>
    {eligible && <OwnedRuntime key={identity.generation + ":" + identity.userId} client={client} config={config} loadPayload={loadPayload} publish={publish} />}
    <AccountWorkspaceContextProvider value={current?.workspace ?? fallback}>
      <AppStateProvider value={current?.app ?? empty}>{children}</AppStateProvider>
    </AccountWorkspaceContextProvider>
  </AccountLoadingContext.Provider>;
}
