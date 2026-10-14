// @vitest-environment jsdom
import {act} from "react";
import {createRoot} from "react-dom/client";
import {beforeEach,afterEach,it,expect,vi} from "vitest";
import type {RuntimeCall} from "../../core/examRuntime";
import {useExamFeedbackTone,type ExamFeedbackToneControls} from "./useExamFeedbackTone";
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
let container:HTMLDivElement,root:ReturnType<typeof createRoot>,controls:ExamFeedbackToneControls;
let call:ReturnType<typeof vi.fn>;
function Harness({account="one",runtime=call as RuntimeCall}:{account?:string;runtime?:RuntimeCall}){controls=useExamFeedbackTone(runtime,account);return null;}
async function render(account="one",runtime=call as RuntimeCall){await act(async()=>root.render(<Harness account={account} runtime={runtime}/>));}
beforeEach(()=>{container=document.createElement("div");document.body.append(container);root=createRoot(container);
 call=vi.fn(async(operation,input)=>({feedbackTone:operation==="preference_update"?input.feedbackTone:"professional"}));});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();});
it("waits for the saved preference and confirms it before start",async()=>{
 let resolve!:(value:unknown)=>void;call.mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));
 await render();expect(controls.canBegin).toBe(false);
 await act(async()=>{resolve({feedbackTone:"supportive"});});
 expect(controls.tone).toBe("supportive");expect(controls.canBegin).toBe(true);
 await act(async()=>{expect(await controls.confirmForStart()).toBe(true);});
 expect(call.mock.calls.at(-1)).toEqual(["preference_update",{feedbackTone:"supportive"}]);
});
it("requires acknowledgement for a saved Ruthless tone and resets it after switching away",async()=>{
 call.mockImplementationOnce(async()=>({feedbackTone:"ruthless"}));await render();
 expect(controls.canBegin).toBe(false);act(()=>controls.acknowledge(true));expect(controls.canBegin).toBe(true);
 await act(async()=>{await controls.select("professional");});
 await act(async()=>{await controls.select("ruthless");});
 expect(controls.acknowledged).toBe(false);expect(controls.canBegin).toBe(false);
});
it("suppresses overlapping saves and refuses start until a failed save is retried",async()=>{
 await render();let resolve!:(value:unknown)=>void;
 call.mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));
 let saved!:Promise<boolean>;await act(async()=>{saved=controls.select("supportive");expect(await controls.select("ruthless")).toBe(false);});
 expect(controls.canBegin).toBe(false);
 await act(async()=>{resolve({feedbackTone:"supportive"});await saved;});
 call.mockRejectedValueOnce(new Error("offline"));await act(async()=>{await controls.select("professional");});
 expect(controls.tone).toBe("professional");expect(controls.canBegin).toBe(false);expect(controls.error).toContain("Couldn’t save");
 await act(async()=>{await controls.retry();});expect(controls.canBegin).toBe(true);
});
it("ignores stale account responses and never carries acknowledgement to another account",async()=>{
 let resolve!:(value:unknown)=>void;call.mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));
 await render("one");const next=vi.fn(async()=>({feedbackTone:"professional"})) as RuntimeCall;
 await render("two",next);await act(async()=>{resolve({feedbackTone:"ruthless"});});
 expect(controls.tone).toBe("professional");expect(controls.acknowledged).toBe(false);expect(controls.canBegin).toBe(true);
});
it("blocks malformed preference responses and supports an explicit read retry",async()=>{
 call.mockImplementationOnce(async()=>({feedbackTone:"unknown"}));await render();
 expect(controls.canBegin).toBe(false);expect(controls.error).toContain("Couldn’t load");
 await act(async()=>{await controls.retry();});expect(controls.canBegin).toBe(true);
});
