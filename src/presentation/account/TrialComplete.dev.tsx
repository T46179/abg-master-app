import { Link } from "react-router-dom";
import type { RuntimeAttempt } from "../../core/examRuntime";
import { Surface } from "../primitives/Surface";
import { CheckIcon } from "./AccountIcons.dev";
import { AccountButton } from "./AccountUi.dev";

const proFeatures = [
  { title: "Full exam question bank", body: "Exam-style cases with detailed marking and feedback." },
  { title: "Custom exams", body: "Build exams around the topics you want to master." },
  { title: "Focused drills", body: "Practice anion gap, compensation, delta ratio, A-a gradient and corrections." },
  { title: "Track your progress", body: "Review past attempts and revisit mistakes in your Error Log." },
];

export function TrialProCard() {
  return <Surface as="aside" className="account-trial-pro" aria-labelledby="account-trial-pro-title">
    <div className="account-trial-pro-top"><span>ABG Master Pro</span></div>
    <h3 id="account-trial-pro-title">Ready to take your exam prep further?</h3>
    <p>You've completed your first exam. Unlock the full question bank, tackle challenging cases, and build confidence in blood gas interpretation.</p>
    <ul>
      {proFeatures.map(({ title, body }) => <li key={title}>
        <span className="account-trial-pro-check"><CheckIcon size={12} /></span>
        <div><strong>{title}</strong><p>{body}</p></div>
      </li>)}
    </ul>
    <div className="account-trial-pro-actions">
      <AccountButton disabled>Unlock full exam access</AccountButton>
      <Link className="account-trial-practice-link" to="/practice">Or continue with free Practice</Link>
    </div>
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
