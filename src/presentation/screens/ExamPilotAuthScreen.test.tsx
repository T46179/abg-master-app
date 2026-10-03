// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  createExamAuthClient: vi.fn(), readExamIdentity: vi.fn(), readExamAccess: vi.fn(),
  requestExamCode: vi.fn(), verifyExamCode: vi.fn(), signOut: vi.fn(), unsubscribe: vi.fn(),
}));
vi.mock("../../core/examAuth", () => mocks);
vi.mock("../exam/ExamPilotRuntime.dev", () => ({ default: () => <div>Runtime connected</div> }));
import ExamPilotAuthScreen from "./ExamPilotAuthScreen.dev";
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let container: HTMLDivElement;
let root: Root;
let authChanged: () => void;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("VITE_EXAM_PILOT_SUPABASE_URL", "https://clpfecuohwzwrgmqzeos.supabase.co");
  vi.stubEnv("VITE_EXAM_PILOT_SUPABASE_ANON_KEY", "public");
  mocks.createExamAuthClient.mockReturnValue({ auth: { onAuthStateChange: (callback: () => void) => { authChanged = callback; return { data: { subscription: { unsubscribe: mocks.unsubscribe } } }; }, signOut: mocks.signOut } });
  mocks.readExamIdentity.mockResolvedValue({ status: "signed_out" });
  mocks.readExamAccess.mockResolvedValue({ status: "closed", allowedUnitCounts: [] });
  mocks.requestExamCode.mockResolvedValue(undefined);
  mocks.verifyExamCode.mockResolvedValue(undefined);
  mocks.signOut.mockResolvedValue({ error: null });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllEnvs(); });
async function render() { await act(async () => root.render(<ExamPilotAuthScreen />)); }
async function enter(selector: string, value: string) {
  const input = container.querySelector<HTMLInputElement>(selector)!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function submit() { await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))); }
it("cannot fall back to production or Practice credentials", async () => {
  vi.stubEnv("VITE_EXAM_PILOT_SUPABASE_URL", "https://fhuapjeydixkfxssuxoe.supabase.co");
  await render();
  expect(container.textContent).toContain("not configured");
  expect(mocks.createExamAuthClient).not.toHaveBeenCalled();
});
it("sends no email until submitted, then verifies code against the requested email", async () => {
  await render();
  expect(mocks.requestExamCode).not.toHaveBeenCalled();
  await enter("#exam-email", "tester@example.test");
  await submit();
  expect(mocks.requestExamCode).toHaveBeenCalledWith(expect.anything(), "tester@example.test");
  await enter("#exam-code", "012345");
  mocks.readExamIdentity.mockResolvedValue({ status: "signed_in", userId: "owner" });
  await submit();
  expect(mocks.verifyExamCode).toHaveBeenCalledWith(expect.anything(), "tester@example.test", "012345");
  expect(container.textContent).toContain("not open yet");
  expect(container.querySelector("#exam-code")).toBeNull();
});
it("shows denied access and keeps it distinct from a service failure", async () => {
  mocks.readExamIdentity.mockResolvedValue({ status: "signed_in", userId: "owner" });
  mocks.readExamAccess.mockResolvedValue({ status: "not_invited", allowedUnitCounts: [] });
  await render();
  expect(container.textContent).toContain("does not have pilot access");
  expect(container.querySelector('[role="alert"]')).toBeNull();
});
it("shows unavailable service and permits retry without sending a new code", async () => {
  mocks.readExamIdentity.mockResolvedValue({ status: "signed_in", userId: "owner" });
  mocks.readExamAccess.mockRejectedValueOnce(new Error("network"));
  await render();
  expect(container.querySelector('[role="alert"]')?.textContent).toContain("couldn’t check");
  await act(async () => container.querySelector<HTMLButtonElement>('[role="alert"] button')!.click());
  expect(container.textContent).toContain("not open yet");
  expect(mocks.requestExamCode).not.toHaveBeenCalled();
});
it("access approval shows the runtime without the sign-in banner or sign-out control", async () => {
  mocks.readExamIdentity.mockResolvedValue({ status: "signed_in", userId: "owner" });
  mocks.readExamAccess.mockResolvedValue({ status: "allowed", allowedUnitCounts: [3] });
  await render();
  expect(container.textContent).toContain("Runtime connected");
  expect(container.textContent).not.toContain("Exam pilot sign-in");
  expect(container.textContent).not.toContain("Sign out");
  expect(container.querySelector("#exam-email")).toBeNull();
});

it("keeps same-account verification silent and the runtime mounted", async () => {
  mocks.readExamIdentity.mockResolvedValue({ status: "signed_in", userId: "owner" });
  mocks.readExamAccess.mockResolvedValue({ status: "allowed", allowedUnitCounts: [3] });
  await render(); const runtime=container.querySelector("main > div")!;
  let finish!: (value: unknown) => void;
  mocks.readExamAccess.mockImplementationOnce(() => new Promise(resolve => { finish=resolve; }));
  await act(async () => authChanged());
  expect(container.textContent).not.toContain("Checking sign-in");
  expect(container.textContent).not.toContain("Exam pilot sign-in");
  expect(container.querySelector("main > div")).toBe(runtime);
  await act(async () => finish({status:"allowed",allowedUnitCounts:[3]}));
  expect(container.textContent).not.toContain("Exam pilot sign-in");
});
it("shows a genuine background failure and supports silent successful recovery", async () => {
  mocks.readExamIdentity.mockResolvedValue({ status: "signed_in", userId: "owner" });
  mocks.readExamAccess.mockResolvedValue({ status: "allowed", allowedUnitCounts: [3] });
  await render(); mocks.readExamAccess.mockRejectedValueOnce(new Error("offline"));
  await act(async () => authChanged());
  expect(container.querySelector('[role="alert"]')?.textContent).toContain("couldn’t check");
  await act(async () => container.querySelector<HTMLButtonElement>('[role="alert"] button')!.click());
  expect(container.querySelector('[role="alert"]')).toBeNull();
  expect(container.textContent).not.toContain("Exam pilot sign-in");
});
it("shows access revocation and session expiry after background verification", async () => {
  mocks.readExamIdentity.mockResolvedValue({ status: "signed_in", userId: "owner" });
  mocks.readExamAccess.mockResolvedValue({ status: "allowed", allowedUnitCounts: [3] });
  await render(); mocks.readExamAccess.mockResolvedValueOnce({ status: "not_invited", allowedUnitCounts: [] });
  await act(async () => authChanged()); expect(container.textContent).toContain("does not have pilot access");
  mocks.readExamIdentity.mockResolvedValueOnce({ status: "signed_out" });
  await act(async () => authChanged()); expect(container.querySelector("#exam-email")).toBeTruthy();
  expect(container.textContent).not.toContain("Runtime connected");
});
it("does not carry an access approval to a different account", async () => {
  mocks.readExamIdentity.mockResolvedValue({ status: "signed_in", userId: "owner" });
  mocks.readExamAccess.mockResolvedValue({ status: "allowed", allowedUnitCounts: [3] });
  await render(); mocks.readExamIdentity.mockResolvedValueOnce({ status: "signed_in", userId: "other" });
  let finish!: (value: unknown) => void;
  mocks.readExamAccess.mockImplementationOnce(() => new Promise(resolve => { finish=resolve; }));
  await act(async () => authChanged()); expect(container.textContent).toContain("Checking sign-in");
  await act(async () => finish({ status: "not_invited", allowedUnitCounts: [] }));
  expect(container.textContent).toContain("does not have pilot access");
});

it("keeps the first verification visible until the initial access check completes", async () => {
  mocks.readExamIdentity.mockResolvedValue({ status: "signed_in", userId: "owner" });
  let finish!: (value: unknown) => void;
  mocks.readExamAccess.mockImplementationOnce(() => new Promise(resolve => { finish=resolve; }));
  await render(); expect(container.textContent).toContain("Checking sign-in");
  expect(container.textContent).not.toContain("Runtime connected");
  await act(async () => finish({status:"allowed",allowedUnitCounts:[3]}));
  expect(container.textContent).toContain("Runtime connected");
  expect(container.textContent).not.toContain("Exam pilot sign-in");
});
