import type { ReactNode } from "react";

export function NoticeMessage({ message }: { message: string }) {
  const end = message.indexOf(". ");
  return end < 0 ? <>{message}</> : <><strong>{message.slice(0, end + 1)}</strong>{message.slice(end + 1)}</>;
}

export function ExamNotice({ children, role = "alert" }: { children: ReactNode; role?: "alert" | "status" }) {
  return <div className="exam-notice" role={role}>{children}</div>;
}

export function RetryAction({ busy, onClick, children = "Retry" }: { busy: boolean; onClick: () => void; children?: ReactNode }) {
  return <button type="button" className="exam-notice__retry" disabled={busy} aria-busy={busy || undefined} onClick={onClick}>
    {busy ? <><span role="status">Retrying…</span><span className="figma-button__spinner" aria-hidden="true" /></> : children}
  </button>;
}
