import { useDrillSession } from "./useDrillSession";
import { useId, useRef, useState, type ReactNode } from "react";
import { drillCounts, type CompensationRule, type DrillCount, type DrillKey, type DrillLoader, type DrillRequest } from "../../core/examDrills";
import type { PressureUnit } from "../../core/types";
import { Surface } from "../primitives/Surface";
import { compensationRules, drillCards, drillDefinitions } from "./drillDefinitions";
import { DrillRunner } from "./DrillRunner";
import { ArrowIcon, CheckIcon } from "./ExamIcons";
import { IconBadge } from "./ExamUi";
import "./drills.css";

const rules = Object.keys(compensationRules) as CompensationRule[];

export function FocusedDrills({ loadDrill, dashboardHeader, pressureUnit }: {
  loadDrill: DrillLoader;
  dashboardHeader: ReactNode;
  pressureUnit: PressureUnit;
}) {
  const [drill, selectDrill] = useState<DrillKey>("anion-gap");
  const [rule, selectRule] = useState<CompensationRule>("met-acidosis");
  const [count, setCount] = useState<DrillCount>(5);
  const { session, busy, error, start, close, setError } = useDrillSession(loadDrill);
  const startButton = useRef<HTMLButtonElement>(null);
  const ruleLabelId = useId();
  const countLabelId = useId();
  const setupTitleId = useId();
  function backToSetup() {
    close();
    requestAnimationFrame(() => startButton.current?.focus());
  }

  const selected = drillDefinitions[drill];
  const ruleTitle = session?.request.drill === "compensation" ? compensationRules[session.request.rule].label : null;
  if (session) return <DrillRunner key={session.id}
    title={ruleTitle ? `${selected.title} · ${ruleTitle}` : selected.title}
    set={session.set}
    request={session.request}
    pressureUnit={pressureUnit}
    busy={busy} error={error}
    onRepeat={() => void start("pressureUnit" in session.request ? { ...session.request, pressureUnit } : session.request)}
    onExit={backToSetup} />;

  const input: DrillRequest = drill === "compensation" ? { drill, count, rule, pressureUnit }
    : drill === "aa-gradient" || drill === "pf-ratio" || drill === "delta-ratio"
      ? { drill, count, pressureUnit } : { drill, count };
  return <>
    {dashboardHeader}
    <div className="exam-workspace exam-drill-workspace">
      <div className="exam-drill-grid" role="group" aria-label="Focused drill">
        {drillCards.map(({ drill: key, shortTitle }) => {
          const { Icon, title, blurb, tone } = drillDefinitions[key];
          return <Surface as="button" type="button" key={key} className="exam-drill-card"
            disabled={busy} aria-pressed={drill === key} onClick={() => { selectDrill(key); setError(""); }}>
            <IconBadge tone={tone}><Icon /></IconBadge>
            <span className="exam-card-title">
              {shortTitle ? <><span className="exam-drill-title-full">{title}</span><span className="exam-drill-title-short">{shortTitle}</span></> : title}
            </span>
            <span className="exam-drill-blurb">{blurb}</span>
          </Surface>;
        })}
      </div>
      <Surface as="aside" className="exam-setup" aria-labelledby={setupTitleId}>
        <p className="exam-eyebrow">Drill setup</p>
        <div className="exam-setup-title">
          <IconBadge tone={selected.tone}><selected.Icon /></IconBadge>
          <h3 id={setupTitleId}>{selected.title}</h3>
        </div>
        {drill === "compensation" && <div className="exam-field">
          <span className="exam-field-label" id={ruleLabelId}>Drill focus</span>
          <div className="exam-rules" role="group" aria-labelledby={ruleLabelId}>
            {rules.map(key => <button type="button" key={key} className="exam-rule" disabled={busy}
              aria-pressed={key === rule} onClick={() => selectRule(key)}>
              <span><strong>{compensationRules[key].label}</strong><span className="exam-small">{compensationRules[key].hint}</span></span>
              <span className="exam-rule-check" aria-hidden="true"><CheckIcon /></span>
            </button>)}
          </div>
        </div>}
        <div className="exam-field">
          <span className="exam-field-label" id={countLabelId}>Questions</span>
          <div className="exam-counts" role="group" aria-labelledby={countLabelId}>
            {drillCounts.map(value => <button type="button" key={value} disabled={busy}
              aria-pressed={value === count} onClick={() => setCount(value)}>{value}</button>)}
          </div>
        </div>
        {error && <p className="exam-inline-error exam-drill-error" role="alert">{error}</p>}
        <button type="button" ref={startButton} className="figma-button exam-primary exam-start" disabled={busy}
          onClick={() => void start(input)}>
          {busy ? <span role="status">Generating questions…</span> : <>Start {selected.title} drill <ArrowIcon /></>}
        </button>
      </Surface>
    </div>
  </>;
}
