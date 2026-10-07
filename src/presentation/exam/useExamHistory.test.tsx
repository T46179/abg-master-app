// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { RuntimeCall } from "../../core/examRuntime";
import type { HistoryPage } from "../../core/examHistory";
import { useExamHistory } from "./useExamHistory";
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let container: HTMLDivElement; let root: ReturnType<typeof createRoot>; let hook: ReturnType<typeof useExamHistory>;
const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12,"0")}`;
function page(n: number, cursor = false): HistoryPage {
  const date = `2026-01-${String(30-n).padStart(2,"0")}T00:00:00Z`;
  return { attempts: [{ id: id(n), createdAt: date, presentedAt: null, finishedAt: date, examKind: "mock", excludedCategories: [], caseCount: 3, marksAvailable: 2, marksAwarded: null, gradingStatus: "pending", canRetryGrading: false }], nextCursor: cursor ? {id:id(n),finishedAt:date} : null,
    latestAttemptId: id(1), total: 2, counts: { all: 2, mock: 2, custom: 0 }, summary: {submitted:2,average:null,best:null,trend:[],totalCases:6,awaiting:2,pending:2} };
}
function Harness({ call, account = "owner", enabled = true }: {call: RuntimeCall; account?: string; enabled?: boolean}) { hook=useExamHistory(call,account,enabled); return <p>{hook.data?.rows.map(r=>r.id).join(",")}</p>; }
beforeEach(() => { container=document.createElement("div");document.body.append(container);root=createRoot(container); });
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.useRealTimers();});
it("loads more, retains rows on failure, refreshes every loaded page and stops polling during a sitting",async()=>{
 vi.useFakeTimers(); const call=vi.fn().mockImplementation(async(_op,input)=>input.cursor?page(2):page(1,true));
 await act(async()=>root.render(<Harness call={call}/>));
 await act(async()=>hook.loadMore());expect(hook.data?.rows).toHaveLength(2);expect(hook.data?.page.summary.submitted).toBe(2);
 call.mockRejectedValueOnce(new Error("offline"));await act(async()=>hook.refresh());expect(hook.data?.rows).toHaveLength(2);expect(hook.error).toBe("offline");
 await act(async()=>hook.refresh());expect(hook.data?.rows).toHaveLength(2);expect(hook.error).toBe("");
 const before=call.mock.calls.length;await act(async()=>vi.advanceTimersByTimeAsync(5000));expect(call.mock.calls.length).toBe(before+2);
 await act(async()=>root.render(<Harness call={call} enabled={false}/>));const stopped=call.mock.calls.length;await act(async()=>vi.advanceTimersByTimeAsync(10000));expect(call.mock.calls.length).toBe(stopped);
});
it("discards late responses across accounts and refreshes on focus",async()=>{
 let resolve!: (v:HistoryPage)=>void;const call=vi.fn().mockImplementationOnce(()=>new Promise(r=>{resolve=r})).mockResolvedValue(page(2));
 await act(async()=>root.render(<Harness call={call}/>));
 await act(async()=>root.render(<Harness call={call} account="other"/>));expect(hook.data?.rows[0].id).toBe(id(2));
 await act(async()=>resolve(page(1,true)));expect(hook.data?.rows[0].id).toBe(id(2));
 const before=call.mock.calls.length;await act(async()=>window.dispatchEvent(new Event("focus")));expect(call.mock.calls.length).toBe(before+1);
});
