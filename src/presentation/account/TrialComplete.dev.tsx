import type { RuntimeAttempt } from "../../core/examRuntime";
import { Surface } from "../primitives/Surface";
import { CheckIcon } from "./AccountIcons.dev";
import { AccountButton } from "./AccountUi.dev";

const proFeatures = [
  { title: "Mock exams on demand", body: "Fresh multi-part cases, marked in detail, whenever you're ready." },
  { title: "Custom exams", body: "Choose your topics, including ventilation and toxicology." },
  { title: "Focused drills", body: "Anion gap, compensation, delta ratio, A-a gradient and corrections." },
  { title: "Past attempts and Error log", body: "Track every sitting and work through what tripped you up." },
];

export function TrialProCard() {
  return <Surface as="aside" className="account-trial-pro" aria-labelledby="account-trial-pro-title">
    <div className="account-trial-pro-top"><span>ABG Master Pro</span><span>Trial used</span></div>
    <h3 id="account-trial-pro-title">Ready for the full Exam Room?</h3>
    <p>You've seen how exam mode works. Pro opens every exam and drill, so you can keep training until it's second nature.</p>
    <ul>
      {proFeatures.map(({ title, body }) => <li key={title}>
        <span className="account-trial-pro-check"><CheckIcon size={12} /></span>
        <div><strong>{title}</strong><p>{body}</p></div>
      </li>)}
    </ul>
    <AccountButton disabled>Unlock full exam access</AccountButton>
    <p className="account-trial-pro-note">Your trial result stays on your account either way.</p>
  </Surface>;
}

export function TrialResultHero({ result }: { result?: RuntimeAttempt }) {
  const awarded = result?.marksAwarded;
  const available = result?.marksAvailable;
  const percent = awarded != null && available ? Math.round(awarded / available * 100) : null;
  const cases = result?.questions.length;
  const parts = result?.questions.reduce((total, question) => total + question.parts.length, 0);
  const graded = result?.parts?.filter(part => part.status === "completed").length;
  const elapsed = result?.presentedAt && result.finishedAt
    ? Math.floor((Date.parse(result.finishedAt) - Date.parse(result.presentedAt)) / 1000)
    : NaN;
  const time = Number.isFinite(elapsed) && elapsed >= 0
    ? `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`
    : "—";

  return <div className="account-trial-recap">
    <div className="exam-hero-top">
      <span className="exam-hero-badge"><CheckIcon size={12} /> Trial exam · Completed</span>
      <span>Grading complete</span>
    </div>
    <div className="account-trial-recap-score">
      <div>
        <h2>Your score</h2>
        <strong>{percent ?? "—"}{percent !== null && <span>%</span>}</strong>
      </div>
      <div className="account-trial-recap-marks">
        <div className="account-trial-recap-track" aria-hidden="true"><span style={{ width: `${percent ?? 0}%` }} /></div>
        {percent !== null && <p><strong>{awarded}/{available}</strong> marks across {cases} {cases === 1 ? "case" : "cases"}</p>}
      </div>
    </div>
    <dl className="exam-hero-stats">
      <div><dd>{cases ?? "—"}</dd><dt>Cases</dt></div>
      <div><dd>{graded != null ? `${graded}/${parts}` : "—"}</dd><dt>Parts graded</dt></div>
      <div><dd>{time}</dd><dt>Time</dt></div>
    </dl>
  </div>;
}
