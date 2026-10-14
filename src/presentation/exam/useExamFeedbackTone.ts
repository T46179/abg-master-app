import { useCallback, useEffect, useRef, useState } from "react";
import type { RuntimeCall } from "../../core/examRuntime";
import { feedbackPreferenceOperation, type FeedbackTone } from "../../core/examFeedback";

type PreferenceState = { context: string; tone: FeedbackTone; ready: boolean; busy: boolean; acknowledged: boolean; error: string };

export function useExamFeedbackTone(call: RuntimeCall | undefined, accountKey: string) {
  const context = accountKey;
  const current = useRef(context); current.current = context;
  const version = useRef(0), changing = useRef(false);
  const [stored, setStored] = useState<PreferenceState>();
  const data = stored?.context === context ? stored : undefined;
  const tone = data?.tone ?? "professional";
  const canBegin = Boolean(data?.ready && !data.busy && !data.error && (tone !== "ruthless" || data.acknowledged));

  const refresh = useCallback(async () => {
    if (!call || changing.current) return;
    const request = ++version.current;
    setStored(old => ({ context, tone: old?.context === context ? old.tone : "professional",
      ready: false, busy: true, acknowledged: false, error: "" }));
    try {
      const next = await feedbackPreferenceOperation(call, "preference_read");
      if (current.current === context && version.current === request) {
        setStored({ context, tone: next.feedbackTone, ready: true, busy: false, acknowledged: false, error: "" });
      }
    } catch {
      if (current.current === context && version.current === request) {
        setStored(old => ({ context, tone: old?.context === context ? old.tone : "professional",
          ready: false, busy: false, acknowledged: false, error: "Couldn’t load your feedback preference. Please try again." }));
      }
    }
  }, [call, context]);

  useEffect(() => {
    ++version.current; changing.current = false;
    void refresh();
    return () => { ++version.current; };
  }, [refresh]);

  async function save(nextTone: FeedbackTone, force = false) {
    if (!call || !data?.ready || changing.current || current.current !== context) return false;
    if (!force && nextTone === tone && !data.error) return true;
    changing.current = true;
    const request = ++version.current;
    const acknowledged = nextTone === tone ? data.acknowledged : false;
    setStored({ context, tone: nextTone, ready: true, busy: true, acknowledged, error: "" });
    try {
      const next = await feedbackPreferenceOperation(call, "preference_update", nextTone);
      if (next.feedbackTone !== nextTone) throw new Error("Preference mismatch");
      if (current.current !== context || version.current !== request) return false;
      setStored({ context, tone: nextTone, ready: true, busy: false, acknowledged, error: "" });
      return true;
    } catch {
      if (current.current === context && version.current === request) {
        setStored({ context, tone: nextTone, ready: true, busy: false, acknowledged,
          error: "Couldn’t save your feedback preference. Please try again." });
      }
      return false;
    } finally {
      if (current.current === context && version.current === request) changing.current = false;
    }
  }

  function acknowledge(checked: boolean) {
    if (!data?.ready || data.busy || tone !== "ruthless") return;
    setStored({ ...data, acknowledged: checked });
  }

  async function confirmForStart() {
    if (!canBegin) return false;
    // Confirm the displayed account preference before the backend snapshots the new attempt.
    return save(tone, true);
  }

  return { tone, busy: data?.busy ?? true, ready: data?.ready ?? false,
    acknowledged: data?.acknowledged ?? false, error: data?.error ?? "", canBegin,
    select: (nextTone: FeedbackTone) => save(nextTone), acknowledge, confirmForStart,
    retry: () => data?.ready ? save(tone, true) : refresh() };
}
export type ExamFeedbackToneControls = ReturnType<typeof useExamFeedbackTone>;
