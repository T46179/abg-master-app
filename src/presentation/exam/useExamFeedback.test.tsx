// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useExamFeedback } from "./useExamFeedback";
import type { RuntimeCall } from "../../core/examRuntime";
import type { SavedFeedbackState } from "../../core/examFeedback";
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root: ReturnType<typeof createRoot>, container: HTMLDivElement, hook: ReturnType<typeof useExamFeedback>;
const state = (status: SavedFeedbackState["status"], attemptId = "a"): SavedFeedbackState => ({
 attemptId, status, generationId: status === "not_requested" ? null : "g", parts: status === "completed"
  ? [{partId:"p",status:"completed",text:"Saved 80 mmHg advice.",helpful:null}] : [], canRetry:status==="failed", retryAfter:null,
});
function Harness({call,account="owner",attemptId="a"}:{call:RuntimeCall;account?:string;attemptId?:string}) {
 hook=useExamFeedback(call,account,attemptId);return <p>{hook.data?.parts[0]?.text}</p>;
}
beforeEach(()=>{container=document.createElement("div");document.body.append(container);root=createRoot(container);});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.useRealTimers();});
it("reads passively, sends one exam-wide request on repeated clicks and polls only pending work",async()=>{
 vi.useFakeTimers();let finish!: (s:SavedFeedbackState)=>void;
 const call=vi.fn().mockImplementation(async(op)=>op==="feedback_read"?state("not_requested"):new Promise(r=>{finish=r}));
 await act(async()=>root.render(<Harness call={call}/>));
 expect(call.mock.calls.map(c=>c[0])).toEqual(["feedback_read"]);
 let first!:Promise<void>;act(()=>{first=hook.request();void hook.request();});
 expect(call.mock.calls.filter(c=>c[0]==="feedback_request")).toHaveLength(1);
 await act(async()=>{finish(state("pending"));await first;});
 call.mockResolvedValue(state("completed"));
 await act(async()=>vi.advanceTimersByTimeAsync(2000));
 expect(hook.data?.status).toBe("completed");const before=call.mock.calls.length;
 await act(async()=>{await hook.request();vi.advanceTimersByTime(6000);});
 expect(call).toHaveBeenCalledTimes(before);
});
it("never automatically retries failed generation and honours the explicit cooldown",async()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date("2026-10-13T00:00:00Z"));
 const failed={...state("failed"),retryAfter:"2026-10-13T00:00:30Z"};
 const call=vi.fn().mockResolvedValue(failed);
 await act(async()=>root.render(<Harness call={call}/>));
 expect(hook.retrySeconds).toBe(30);await act(async()=>hook.retry());
 expect(call.mock.calls.map(c=>c[0])).toEqual(["feedback_read"]);
 await act(async()=>vi.advanceTimersByTimeAsync(30000));
 expect(hook.retrySeconds).toBe(0);await act(async()=>hook.retry());
 expect(call.mock.calls.at(-1)?.[0]).toBe("feedback_retry");
});
it("ignores a late read after generation and discards responses from another account/attempt",async()=>{
 let finishRead!: (s:SavedFeedbackState)=>void;
 const call=vi.fn().mockImplementationOnce(()=>new Promise(r=>{finishRead=r})).mockResolvedValue(state("pending"));
 await act(async()=>root.render(<Harness call={call}/>));
 await act(async()=>hook.request());await act(async()=>finishRead(state("not_requested")));
 expect(hook.data?.status).toBe("pending");
 call.mockResolvedValue(state("completed","b"));
 await act(async()=>root.render(<Harness call={call} account="other" attemptId="b"/>));
 expect(hook.data?.attemptId).toBe("b");
});
it("persists changeable votes without requesting new feedback",async()=>{
 const call=vi.fn().mockResolvedValue(state("completed"));
 await act(async()=>root.render(<Harness call={call}/>));
 const no=state("completed");no.parts[0].helpful=false;call.mockResolvedValueOnce(no);
 await act(async()=>hook.vote("p",false));expect(hook.data?.parts[0].helpful).toBe(false);
 expect(call.mock.calls.at(-1)).toEqual(["feedback_vote",{attemptId:"a",generationId:"g",partId:"p",helpful:false}]);
 await act(async()=>hook.vote("p",true));expect(call.mock.calls.some(c=>c[0]==="feedback_request")).toBe(false);
});
