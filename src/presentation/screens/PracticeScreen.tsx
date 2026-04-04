import { useAppContext } from "../../app/AppProvider";
import { LegacyPracticeScreen } from "./LegacyPracticeScreen";
import { ProtectedPracticeScreen } from "./ProtectedPracticeScreen";

export function PracticeScreen() {
  const { state } = useAppContext();
  if (state.payload?.deliveryMode === "protected_runtime") {
    return <ProtectedPracticeScreen />;
  }

  return <LegacyPracticeScreen />;
}
