import { useEffect, useState } from "react";

import type { AccountWorkspace } from "../../app/AccountWorkspace";

import { useSiteAccount } from "../../app/SiteAccountProvider";

import { readExamAccess, type ExamAccess } from "../../core/examAuth";

import ExamPilotRuntime from "../exam/ExamPilotRuntime";



/** Identity is site-wide; the existing server still decides Exam access. */

export function SiteAccountExamScreen({ workspace }: { workspace: AccountWorkspace }) {

  const { identity } = useSiteAccount();

  const [access, setAccess] = useState<ExamAccess | null>(null);

  const [error, setError] = useState(false);

  const [revision, setRevision] = useState(0);

  useEffect(() => {

    let cancelled = false;

    setAccess(null); setError(false);

    if (identity.status === "verified" && workspace.client && workspace.userId) {

      void readExamAccess(workspace.client).then(next => {

        if (!cancelled && workspace.isCurrent()) setAccess(next);

      }).catch(() => { if (!cancelled && workspace.isCurrent()) setError(true); });

    }

    return () => { cancelled = true; };

  }, [workspace, identity.status, revision]);

  if (identity.status !== "verified" || !workspace.client || !workspace.userId) return <main><h1>Exam</h1><p>Sign in to your verified account using the account controls above.</p></main>;

  if (error) return <main><p role="alert">We couldn’t check Exam access.</p><button onClick={() => setRevision(n => n + 1)}>Retry access check</button></main>;

  if (!access) return <main><p role="status">Checking Exam access…</p></main>;

  return <main className="app-shell__page exam-screen">

    {access.status !== "allowed" && <p role="status">{access.status === "closed" ? "You’re signed in. The Exam pilot is not open yet." : "You’re signed in, but this account does not have pilot access."}</p>}

    <ExamPilotRuntime client={workspace.client} userId={workspace.userId} canStart={access.status === "allowed"}

      allowedUnitCounts={access.allowedUnitCounts} customisationCategories={access.customisationCategories}

      environment={new URL(String(workspace.runtimeConfig.SUPABASE_URL)).hostname.split(".")[0]} />

  </main>;

}

