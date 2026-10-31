import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from "react";
import { sittingReducer, type SittingAction } from "./sittingModel";
import type { SittingState } from "./sittingTypes";

const Context = createContext<{ sitting: SittingState | null; dispatch: Dispatch<SittingAction> } | null>(null);
export function ExamSittingProvider({ children }: { children: ReactNode }) {
  const [sitting, dispatch] = useReducer(sittingReducer, null);
  return <Context.Provider value={{ sitting, dispatch }}>{children}</Context.Provider>;
}
export function useOptionalExamSitting() { return useContext(Context); }
export function useExamSitting() {
  const value = useContext(Context);
  if (!value) throw new Error("Exam sitting requires its provider");
  return value;
}

