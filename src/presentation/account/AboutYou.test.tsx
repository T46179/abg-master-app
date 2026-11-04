// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { emptyExamOnboarding, type ExamOnboarding } from "../../core/examOnboarding";
import { AboutYou } from "./AboutYou.dev";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const done = vi.fn();
const scroll = vi.fn();
function Form({ initial }: { initial: ExamOnboarding }) {
  const [value, setValue] = useState(initial);
  return <AboutYou value={value} onChange={setValue} onDone={done} storageError={false} />;
}
async function mount(initial = { ...emptyExamOnboarding(), role: "Doctor" }) {
  await act(async () => root.render(<Form initial={initial} />));
}
async function submit() {
  await act(async () => container.querySelector<HTMLButtonElement>('button[type="submit"]')!.click());
}
async function select(key: string, value: string) {
  await act(async () => container.querySelector<HTMLInputElement>(`#exam-about-${key} input[value="${value}"]`)!.click());
}
beforeEach(() => {
  done.mockClear(); scroll.mockClear();
  container = document.createElement("div"); document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals();
});

it("keeps all four applicable questions neutral and required before submission", async () => {
  await mount();
  expect(container.querySelectorAll(".account-question-required")).toHaveLength(4);
  expect([...container.querySelectorAll<HTMLInputElement>('input[type="radio"]')].every(input => input.required)).toBe(true);
  expect(container.querySelector('[aria-invalid="true"]')).toBeNull();
  expect(container.querySelector('[role="alert"]')).toBeNull();
  expect(container.textContent).not.toContain("Choose one to continue");
  expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(false);
});

it("validates groups, scrolls and focuses the first missing answer, then clears errors individually", async () => {
  await mount();
  Object.defineProperty(container.querySelector("#exam-about-stage"), "scrollIntoView", { value: scroll });
  await submit();
  expect(done).not.toHaveBeenCalled();
  expect(container.querySelectorAll('fieldset[aria-invalid="true"]')).toHaveLength(3);
  expect(container.querySelectorAll('[role="alert"]')).toHaveLength(3);
  expect(document.activeElement).toBe(container.querySelector("#exam-about-stage input"));
  expect(document.activeElement?.getAttribute("aria-describedby")).toBe("exam-about-stage-error");
  expect(scroll).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });
  expect(container.textContent).not.toContain("Answer the highlighted questions");
  await select("stage", "Registrar / specialty trainee");
  expect(container.querySelector("#exam-about-stage-error")).toBeNull();
  expect(container.querySelector("#exam-about-stage")?.hasAttribute("aria-invalid")).toBe(false);
  expect(container.querySelectorAll('fieldset[aria-invalid="true"]')).toHaveLength(2);
  await select("specialty", "Emergency medicine");
  await select("reason", "Preparing for an exam");
  expect(container.querySelector('[role="alert"]')).toBeNull();
  await submit();
  expect(done).toHaveBeenCalledWith(expect.objectContaining({ complete: true, role: "Doctor", stage: "Registrar / specialty trainee", specialty: "Emergency medicine", reason: "Preparing for an exam" }));
});

it("validates an unanswered role and preserves conditional questions when the role changes", async () => {
  await mount(emptyExamOnboarding());
  await submit();
  expect(container.querySelectorAll('fieldset[aria-invalid="true"]')).toHaveLength(2);
  expect(document.activeElement).toBe(container.querySelector("#exam-about-role input"));
  await select("role", "Doctor");
  expect(container.querySelector("#exam-about-role-error")).toBeNull();
  expect(container.querySelector("#exam-about-stage-error")).not.toBeNull();
  expect(container.querySelector("#exam-about-specialty-error")).not.toBeNull();
  await select("role", "Medical student");
  expect(container.querySelector("#exam-about-stage")).toBeNull();
  expect(container.querySelector("#exam-about-specialty")).toBeNull();
  await select("reason", "General study and revision");
  await submit();
  expect(done).toHaveBeenCalledWith(expect.objectContaining({ complete: true, role: "Medical student", stage: "", specialty: "" }));
});
