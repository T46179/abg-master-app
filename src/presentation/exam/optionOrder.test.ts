import { expect, it } from "vitest";
import { prepareExamQuestions, sittingReducer } from "./sittingModel";
import { demoQuestions } from "./demoFixtures.dev";

it("shuffles eligible options without mutating fixtures and preserves fixed pressure options", () => {
  const before = JSON.stringify(demoQuestions);
  const prepared = prepareExamQuestions(demoQuestions, () => 0);
  for (let q = 0; q < demoQuestions.length; q++) {
    for (let p = 0; p < demoQuestions[q].parts.length; p++) {
      const source = demoQuestions[q].parts[p];
      const result = prepared[q].parts[p];
      if (!source.options) { expect(result.options).toBeUndefined(); continue; }
      expect(result.options!.map(o => o.id).sort()).toEqual(source.options.map(o => o.id).sort());
      if (source.optionOrder === "fixed") expect(result.options).toEqual(source.options);
      else expect(result.options).not.toEqual(source.options);
      for (const option of result.options!) expect(option).toEqual(source.options.find(o => o.id === option.id));
    }
  }
  expect(JSON.stringify(demoQuestions)).toBe(before);
  expect(prepareExamQuestions(demoQuestions, () => 0.999)).not.toEqual(prepared);
});

it("defaults omitted option order to randomised and retains order and answers through submission", () => {
  const source = [{ ...demoQuestions[0], parts: [{ ...demoQuestions[0].parts[0], optionOrder: undefined }] }];
  const prepared = prepareExamQuestions(source, () => 0);
  expect(prepared[0].parts[0].options).not.toEqual(source[0].parts[0].options);
  const part = prepared[0].parts[0];
  const answer = part.options![0].id;
  let state = sittingReducer(null, { type: "start", questions: prepared, pressureUnit: "kPa", now: 0 })!;
  state = sittingReducer(state, { type: "answer", partId: part.id, value: answer })!;
  state = sittingReducer(state, { type: "jump", questionIndex: 0 })!;
  state = sittingReducer(state, { type: "review" })!;
  state = sittingReducer(state, { type: "return" })!;
  state = sittingReducer(state, { type: "review" })!;
  state = sittingReducer(state, { type: "submit", now: 10 })!;
  expect(state.questions).toBe(prepared);
  expect(state.answers[part.id]).toBe(answer);
  expect(state.phase).toBe("complete");
});
