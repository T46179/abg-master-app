export const CLINICAL_PEARLS = [
  "A normal pH does not mean a normal gas. Mixed disorders can pull the pH back toward normal while the patient is still critically unwell.",
  "In metabolic acidosis, a “normal” PaCO₂ is often abnormal. If the bicarbonate is low, the PaCO₂ should usually be low as well.",
  "Winter’s formula is less about memorising a number and more about asking: “Is the patient ventilating enough for this degree of acidosis?”",
  "Severe metabolic acidosis with inadequate respiratory compensation is a dangerous pattern. It often means fatigue, CNS depression, lung disease, or impending arrest.",
  "In high anion gap metabolic acidosis, always look for a second process. DKA, sepsis, renal failure, and toxins often do not arrive alone.",
  "A raised anion gap explains the acidosis, but it does not exclude a concurrent metabolic alkalosis or normal-gap acidosis.",
  "The delta ratio is most useful when the anion gap is raised. Outside HAGMA, it is usually not the main interpretive tool.",
  "DKA with vomiting can hide a metabolic alkalosis. The pH may look less severe than the underlying ketoacidosis really is.",
  "Salicylate toxicity classically produces mixed respiratory alkalosis and metabolic acidosis. A near-normal pH in this setting can be falsely reassuring.",
  "Sepsis may begin with respiratory alkalosis before lactate rises. Hyperventilation can be an early clue to systemic illness.",
  "In lactic acidosis, the lactate explains the gap but not necessarily the whole gas. Check whether compensation is appropriate.",
  "A low bicarbonate is not always purely metabolic. Chronic respiratory alkalosis can lower bicarbonate through renal compensation.",
  "A high bicarbonate is not always purely metabolic. Chronic CO₂ retention can raise bicarbonate as compensation.",
  "Acute and chronic respiratory acidosis behave differently. The bicarbonate should rise much more in chronic CO₂ retention than in an acute hypoventilation event.",
  "COPD patients can still develop acute respiratory acidosis on top of chronic compensation. Compare the pH against the bicarbonate, not just the PaCO₂.",
  "In respiratory acidosis, the pH tells you how acute the problem feels. A very low pH with high PaCO₂ suggests the kidneys have not had time to compensate.",
  "In opioid toxicity, the primary problem is often ventilation, not oxygenation. Oxygen may improve SpO₂ while CO₂ continues to rise.",
  "Hypoxaemia with hypercapnia can be from hypoventilation, but a large A–a gradient points to impaired gas transfer as well.",
  "The A–a gradient helps separate “not enough alveolar oxygen” from “oxygen cannot get from alveoli to blood.”",
  "On 100% oxygen, a low PaO₂ is never subtle. It suggests severe oxygen transfer failure or major shunt physiology.",
  "The P/F ratio is only meaningful when you know the FiO₂. A PaO₂ of 80 is very different on room air compared with FiO₂ 1.0.",
  "A low SpO₂ with a surprisingly normal PaO₂ should make you think about dyshemoglobins, waveform quality, or measurement mismatch.",
  "Carbon monoxide poisoning can have a normal PaO₂ and a falsely reassuring pulse oximeter reading. The problem is oxygen carriage, not dissolved oxygen.",
  "MetHb can cause low saturations that do not correct as expected with oxygen. The PaO₂ may still look deceptively adequate.",
  "Albumin matters when interpreting the anion gap. A “normal” gap may actually be raised in severe hypoalbuminaemia.",
  "Hyperchloraemic acidosis often points toward bicarbonate loss or chloride gain. Think diarrhoea, renal tubular acidosis, or large-volume saline.",
  "A normal anion gap metabolic acidosis with a high chloride is not benign by default. The clinical context decides whether it is expected or pathological.",
  "Diarrhoea and renal tubular acidosis can look similar on the gas. The history, potassium, urine studies, and renal context help separate them.",
  "Metabolic alkalosis is often chloride-responsive when driven by vomiting, NG losses, or diuretics. The chloride can be as informative as the bicarbonate.",
  "Severe metabolic alkalosis can suppress ventilation. A raised PaCO₂ may be appropriate compensation rather than a separate respiratory acidosis.",
  "Compensation does not fully normalise the pH. If the pH is completely normal, actively look for a mixed disorder.",
  "Do not interpret PaCO₂ in isolation. The same PaCO₂ can be appropriate, inadequate, or excessive depending on the bicarbonate.",
  "Do not interpret bicarbonate in isolation. It may be the primary problem or the renal response to a respiratory disorder.",
  "In a crashing patient, a falling PaCO₂ can be compensation, pain, sepsis, or ventilator strategy. The pH and bicarbonate tell you which story fits.",
  "In severe asthma, a normal or rising PaCO₂ is ominous. It can signal exhaustion and impending ventilatory failure.",
  "In pregnancy, respiratory alkalosis is often physiological. A PaCO₂ that seems “normal” for a non-pregnant adult may be abnormal in late pregnancy.",
  "Post-arrest gases often show mixed pathology. Lactic acidosis, ventilation changes, and oxygenation failure can all coexist.",
  "The base excess gives a useful metabolic summary, but it does not replace stepwise interpretation. Mixed disorders still need to be actively sought.",
  "Lactate is a marker of physiology, not just sepsis. Shock, seizures, beta-agonists, liver failure, and regional ischaemia can all raise it.",
  "After a seizure, lactate can be dramatically elevated and then clear quickly. A persistently rising lactate needs another explanation.",
  "The gas is a snapshot, not a diagnosis. Trends often reveal whether treatment is working before the patient looks clinically different.",
  "A worsening pH despite treatment is more important than a single impressive number. Direction of travel matters.",
  "In renal failure, a high anion gap acidosis may be chronic, acute, or both. The pH and compensation help judge urgency.",
  "Toxic alcohols may produce a high osmolar gap early and high anion gap later. A normal anion gap does not exclude early poisoning.",
  "Chloride and sodium are not “extra” values in metabolic acidosis. They are what allow you to calculate and interpret the anion gap.",
  "Hyperglycaemia can lower measured sodium through dilution. Corrected sodium helps judge true water deficit and severity.",
  "Profound hypothermia adds interpretation caveats, but it does not make the gas meaningless. The overall acid-base pattern still needs to be recognised.",
  "In metabolic acidosis, the patient’s respiratory effort is part of the compensation. Sedation, fatigue, or intubation can abruptly worsen the pH.",
  "Ventilating a severe metabolic acidosis patient requires matching their pre-intubation minute ventilation. Under-ventilation after intubation can be catastrophic.",
  "A blood gas should answer three questions: what is the primary disorder, is compensation appropriate, and is there another process hiding underneath?"
] as const;

export const EMPTY_CLINICAL_PEARL = "Review the full acid-base pattern and clinical context before drawing a conclusion.";

export function getLocalDayNumber(date = new Date()): number {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
}

export function getDailyClinicalPearl(
  date = new Date(),
  pearls: readonly string[] = CLINICAL_PEARLS
): string {
  if (!pearls.length) return EMPTY_CLINICAL_PEARL;
  return pearls[getLocalDayNumber(date) % pearls.length];
}
