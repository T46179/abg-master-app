import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useSiteAccount } from "../../app/SiteAccountProvider";
import { useOptionalRegistration, useRegistration } from "../../app/RegistrationProvider";
import { useAppContext } from "../../app/AppProvider";
import { useOptionalExamSitting } from "../exam/ExamSittingContext";
import { ProfileControl } from "./ExamAccountExperience.dev";
import { registrationDestination } from "../../core/registrationCallback";
export default function AccountNav() {
  const registration = useOptionalRegistration();
  return registration ? <ConnectedAccountNav /> : null;
}
function ConnectedAccountNav() {
  const { account, identity } = useSiteAccount(); const { registration, hasPassword, paid, togglePaid } = useRegistration();
  const { state } = useAppContext(); const sitting = useOptionalExamSitting()?.sitting ?? null; const navigate = useNavigate(); const location = useLocation();
  const active = Boolean(sitting && sitting.phase !== "complete");
  useEffect(() => {
    if (identity.status === "signed_out" && /^\/(practice|dashboard|insights|learn|calibration|featured-case)(\/|$)/.test(location.pathname)) void account.continueAsGuest().catch(() => undefined);
  }, [location.pathname, identity.status, account]);
  async function signOut() {
    if (registration.isBusy()) return;
    let saved = false;
    try { saved = Boolean(identity.userId && localStorage.getItem("abgm-exam-pilot-clpfecuohwzwrgmqzeos-" + identity.userId)); } catch { /* Runtime reports unavailable storage. */ }
    if ((active || saved || state.practiceState.currentCase || state.practiceState.pendingSubmission) && !window.confirm("Sign out with unfinished work? Saved work stays with its original account. Guest progress may no longer be accessible after signing out.")) return;
    registration.resetView();
    try { await account.signOut(); void navigate("/dev/exam-pilot", { replace: true }); }
    catch { window.alert("Sign-out could not be completed. Please try again."); }
  }
  return <ProfileControl email={identity.status === "verified" ? identity.email : null} busy={registration.isBusy()} paid={paid} active={active || hasPassword !== true}
    onPage={page => { registration.resetView(); const destination = registrationDestination(location.pathname.split("/")[1]); void navigate("/dev/exam-pilot?account=" + page + "&return_to=" + destination); }}
    onSignOut={() => void signOut()} onPaid={() => { if (!active && hasPassword === true) { togglePaid(); registration.resetView(); void navigate("/dev/exam-pilot"); } }} />;
}
