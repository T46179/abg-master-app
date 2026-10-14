// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ExamFeedbackCard } from "./ExamFeedbackCard";
import ExamResultsPresentation from "./ExamResultsPresentation";
import type { ExamFeedbackControls } from "./useExamFeedback";
import type { SittingState } from "./sittingTypes";
import type { PartFeedback } from "./resultsTypes";
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
let root:ReturnType<typeof createRoot>,container:HTMLDivElement;
const controls=(status="not_requested",helpful:boolean|null=null):ExamFeedbackControls=>({
 data:{attemptId:"a",generationId:status==="not_requested"?null:"g",status:status as any,
  parts:status==="completed"?[{partId:"p",status:"completed",text:"Compare PaO2: 80 to 325 mmHg.",helpful}]:[],
  canRetry:status==="failed",retryAfter:null},
 loading:false,busy:false,votingPart:undefined,error:"",retrySeconds:0,
 refresh:vi.fn().mockResolvedValue(undefined),request:vi.fn().mockResolvedValue(undefined),
 retry:vi.fn().mockResolvedValue(undefined),vote:vi.fn().mockResolvedValue(undefined),
});
beforeEach(()=>{Object.defineProperty(HTMLDialogElement.prototype,"showModal",{configurable:true,value:function(){this.open=true;}});
 container=document.createElement("div");document.body.append(container);root=createRoot(container);});
afterEach(()=>{act(()=>root.unmount());container.remove();});
function render(c=controls(),onReport=vi.fn().mockResolvedValue(undefined)){
 act(()=>root.render(<ExamFeedbackCard partId="p" marksLost={2} questionId="q" questionNumber={1} partNumber={2} controls={c} onReport={onReport}/>));
}
it("shows the on-demand mockup and never explains the exam-wide action or offers regeneration",async()=>{
 const c=controls();render(c);
 expect(container.textContent).toContain("See why you lost 2 marks");
 expect(container.textContent).not.toMatch(/whole exam|all Parts|Regenerate/i);
 await act(async()=>[...container.querySelectorAll("button")].find(b=>b.textContent==="Get Feedback")!.click());
 expect(c.request).toHaveBeenCalledTimes(1);
});
it("reveals the report link only after a saved No vote and reuses the reporting contract",async()=>{
 const submit=vi.fn().mockResolvedValue(undefined);render(controls("completed"),submit);
 expect(container.textContent).not.toContain("Report a problem with this feedback");
 render(controls("completed",false),submit);
 expect(container.querySelector("dialog")).toBeNull();
 act(()=>[...container.querySelectorAll("button")].find(b=>b.textContent==="Report a problem with this feedback")!.click());
 expect(container.querySelector("dialog")).toBeTruthy();
 act(()=>container.querySelector<HTMLInputElement>('input[type="radio"]')!.click());
 await act(async()=>[...container.querySelectorAll("button")].find(b=>b.textContent==="Submit")!.click());
 expect(submit.mock.calls[0][0]).toMatchObject({questionId:"q",target:"feedback",partId:"p",generationId:"g"});
 render(controls("completed",true),submit);
 expect(container.textContent).not.toContain("Report a problem with this feedback");
});
it("shows unavailable results without voting and gates a failed-generation retry",()=>{
 const c=controls("completed");c.data!.parts=[{partId:"p",status:"unavailable",text:null,helpful:null}];render(c);
 expect(container.textContent).toContain("Sorry, we couldn't generate feedback for this answer.");
 expect(container.textContent).not.toContain("Was this helpful?");
 const failed=controls("failed");failed.retrySeconds=20;render(failed);
 expect(container.querySelector<HTMLButtonElement>(".exam-ai-feedback__cta")!.disabled).toBe(true);
 expect(container.textContent).toContain("Retry in 20s");
});
it("places eligible cards between criteria and teaching, excludes correct/unanswered/numeric/deterministic Parts, and preserves original feedback units",()=>{
 const types=["concept","concept","numeric","concept","concept"] as const;
 const parts=types.map((kind,i)=>({id:"p"+i,kind,prompt:"Prompt",marks:1}));
 const sitting:SittingState={questions:[{id:"q",tables:[],parts}],phase:"complete",questionIndex:0,partIndices:{},
  answers:{p0:"Wrong answer",p1:"Correct answer",p2:"99",p4:"Deterministic answer"},pressureUnit:"mmHg",
  showRanges:true,showTimer:false,startedAt:0,finishedAt:1000};
 const f:PartFeedback={answer:{mmHg:"Expected",kPa:"Expected"},reasoning:{mmHg:"Teaching",kPa:"Teaching"},
  primaryObjective:"test",display:"text_and_resources",resources:[],criteria:[{id:"c",label:"Criterion"}]};
 const c=controls("completed");c.data!.parts[0].partId="p0";
 const feedback=Object.fromEntries(parts.map((p,i)=>[p.id,{...f,criteria:i===2||i===4?[]:f.criteria}]));
 const grades=Object.fromEntries(parts.map((p,i)=>[p.id,{status:"completed" as const,score:i===1?1:0,criteria:{c:i===1?1:0}}]));
 act(()=>root.render(<ExamResultsPresentation sitting={sitting} pressureUnit="kPa" onExit={()=>{}}
  feedback={feedback} grades={grades} aiFeedback={c}/>));
 expect(container.querySelectorAll(".exam-ai-feedback")).toHaveLength(1);
 const parent=container.querySelector(".exam-ai-feedback")!.parentElement!;
 expect(parent.innerHTML.indexOf("exam-results__criteria")).toBeLessThan(parent.innerHTML.indexOf("exam-ai-feedback"));
 expect(parent.innerHTML.indexOf("exam-ai-feedback")).toBeLessThan(parent.innerHTML.indexOf("exam-results__reasoning"));
 expect(container.querySelector(".exam-ai-feedback")!.textContent).toContain("325 mmHg");
});

it("formats saved clinical notation without changing its text, units or interpreting model text as HTML",()=>{
 const c=controls("completed");
 const original="HCO3 19; PaCO2 29 mmHg; PaO₂ 80→325 mmHg on FiO2 0.5; K+ 5.5 mmol/L. <img src=x onerror=alert(1)>";
 c.data!.parts[0].text=original;render(c);
 const message=container.querySelector(".exam-ai-feedback__text")!;
 expect([...message.querySelectorAll("sub")].map(n=>n.textContent)).toEqual(["3","2","2","2"]);
 expect([...message.querySelectorAll("sup")].map(n=>n.textContent)).toEqual(["-","+"]);
 expect(message.textContent).toContain("29 mmHg");
 expect(message.textContent).toContain("<img src=x onerror=alert(1)>");
 expect(message.querySelector("img")).toBeNull();
 expect(c.data!.parts[0].text).toBe(original);
});
