import { useState, type FormEvent } from "react";
import { EXAM_ROLES, EXAM_STAGES, EXAM_SPECIALTIES, EXAM_NURSING_SPECIALTIES, EXAM_REASONS, missingExamOnboarding, normaliseExamOnboarding, type ExamOnboarding } from "../../core/examOnboarding";
import { AccountButton, AccountCard } from "./AccountUi.dev";
export function AboutYou({ value, onChange, onDone, storageError }: { value: ExamOnboarding; onChange: (v: ExamOnboarding) => void; onDone: (v: ExamOnboarding) => void; storageError: boolean }) {
  const [submitted, setSubmitted] = useState(false);
  const missing = missingExamOnboarding(value);
  function submit(event: FormEvent) {
    event.preventDefault(); setSubmitted(true);
    if (missing.length) { document.querySelector<HTMLInputElement>(`#exam-about-${missing[0]} input`)?.focus(); return; }
    onDone({ ...normaliseExamOnboarding(value), complete: true });
  }
  function question(key: "role" | "stage" | "specialty" | "reason", title: string, options: readonly string[]) {
    const error = submitted && missing.includes(key);
    return <fieldset id={`exam-about-${key}`} className="account-question" aria-describedby={error ? `exam-about-${key}-error` : undefined}>
      <legend>{title}</legend>{error && <p className="account-field-error" id={`exam-about-${key}-error`}>Choose one to continue</p>}
      <div className="account-options">{options.map(option => <label key={option} data-selected={value[key] === option}><input type="radio" name={`exam-about-${key}`} value={option} checked={value[key] === option} onChange={() => onChange(normaliseExamOnboarding({ ...value, [key]: option, complete: false }))} /><span aria-hidden="true" />{option}</label>)}</div>
    </fieldset>;
  }
  return <AccountCard className="account-entry-card account-about-card" title="Tell us a little about yourself">
    <form className="account-form" noValidate onSubmit={submit}>
      {question("role", "Professional role", EXAM_ROLES)}
      {value.role === "Other" && <label className="account-other">Your role (optional)<input maxLength={120} value={value.otherRole} onChange={event => onChange({ ...value, otherRole: event.target.value, complete: false })} /></label>}
      {value.role === "Doctor" && question("stage", "Stage of training", EXAM_STAGES)}
      {["Doctor", "Nurse"].includes(value.role) && question("specialty", "Specialty", value.role === "Nurse" ? EXAM_NURSING_SPECIALTIES : EXAM_SPECIALTIES)}
      {value.role === "Nurse" && value.specialty === "Other" && <label className="account-other">Your specialty (optional)<input maxLength={120} value={value.otherSpecialty} onChange={event => onChange({ ...value, otherSpecialty: event.target.value, complete: false })} /></label>}
      {question("reason", "What is your main reason for using ABG Master?", EXAM_REASONS)}
      {submitted && missing.length > 0 && <p role="alert" className="account-field-error">Answer the highlighted questions to continue.</p>}
      {storageError && <p role="alert" className="account-field-error">Your answers could not be saved on this device. Enable browser storage and try again.</p>}
      <AccountButton type="submit" className="account-entry-submit" showArrow={false}>Continue to exam setup</AccountButton>
      <p className="account-footnote account-entry-footer">Your answers help us improve ABG Master</p>
    </form>
  </AccountCard>;
}
