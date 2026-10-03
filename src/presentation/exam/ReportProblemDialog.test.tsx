// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { QuestionProblemReport, type SubmitProblemReport } from "./ReportProblemDialog";
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  HTMLDialogElement.prototype.showModal = vi.fn();
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); });
function button(text: string) { return [...container.querySelectorAll("button")].find(x => x.textContent === text)!; }
function open(onSubmit?: SubmitProblemReport) {
  act(() => root.render(<QuestionProblemReport number={2} questionId="EXAM-0003" onSubmit={onSubmit} />));
  act(() => button("Report a problem with this question").click());
  act(() => container.querySelector<HTMLInputElement>("input")!.click());
}
function details(text: string) {
  const input = container.querySelector("textarea")!;
  act(() => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(input, text); input.dispatchEvent(new Event("input", { bubbles: true })); });
}
it("keeps the prototype submit disabled and limits optional details", () => {
  open(); expect(button("Submit").disabled).toBe(true); expect(container.querySelector("textarea")!.maxLength).toBe(2000);
});
it("retains wording after failure and reuses the request ID until editing", async () => {
  const submit = vi.fn().mockRejectedValue(new Error("timeout")); open(submit); details("  My wording.\n");
  await act(async () => button("Submit").click());
  expect(container.querySelector("textarea")!.value).toBe("  My wording.\n"); expect(container.querySelector('[role="alert"]')).toBeTruthy();
  await act(async () => button("Submit").click());
  expect(submit.mock.calls[0][0]).toEqual(submit.mock.calls[1][0]);
  details("Edited"); await act(async () => button("Submit").click());
  expect(submit.mock.calls[2][0].requestId).not.toBe(submit.mock.calls[0][0].requestId);
  expect(submit.mock.calls[2][0].questionId).toBe("EXAM-0003");
});
it("blocks duplicates while saving and retains a dismissible success message", async () => {
  let complete!: () => void; const submit=vi.fn(() => new Promise<void>(resolve => { complete=resolve; })); open(submit);
  const submitButton=button("Submit");
  act(() => { submitButton.click(); submitButton.click(); });
  expect(submit).toHaveBeenCalledTimes(1); expect(button("Submitting").disabled).toBe(true); expect(container.querySelector(".exam-report-dialog__spinner")).toBeTruthy(); expect(container.querySelector("dialog")).toBeTruthy();
  await act(async () => complete());
  expect(container.querySelector("dialog")).toBeTruthy();
  expect(container.querySelector("textarea")).toBeNull();
  expect(container.querySelector('[role="status"]')!.textContent).toContain("Report Submitted.");
  expect(container.textContent).toContain("Thank you for your feedback. We will look into it as soon as possible.");
  const close = container.querySelector<HTMLButtonElement>('[aria-label="Close report dialog"]')!;
  expect(document.activeElement).toBe(close); act(() => close.click()); expect(container.querySelector("dialog")).toBeNull();
});
