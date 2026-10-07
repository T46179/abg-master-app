import type { ExamFeedback } from "./resultsTypes";

// GENERATED DEV-only teaching snapshot. Never ship or import into active assessment.
// Refresh alongside assessment: py -B -m generator.exam_preview
export const demoFeedback: ExamFeedback = {
  "EXAM-0001-P1": {
    "answer": {
      "mmHg": "Acute respiratory alkalosis without an additional metabolic disturbance",
      "kPa": "Acute respiratory alkalosis without an additional metabolic disturbance"
    },
    "reasoning": {
      "mmHg": "The alkalaemia and low PCO₂ support respiratory alkalosis in this acute presentation. The bicarbonate does not suggest an additional metabolic disturbance.",
      "kPa": "The alkalaemia and low PCO₂ support respiratory alkalosis in this acute presentation. The bicarbonate does not suggest an additional metabolic disturbance."
    },
    "primaryObjective": "acid_base.primary_process",
    "criteria": [],
    "display": "resources_with_text_fallback",
    "resources": [],
    "rationales": [
      {
        "id": "EXAM-0001-P1-O2",
        "text": {
          "mmHg": "The bicarbonate of 22 mmol/L is consistent with the expected acute response to respiratory alkalosis. A fall in PCO₂ from 40 mmHg to 30 mmHg would lower bicarbonate by approximately 2 mmol/L, so an additional metabolic acidosis is not required to explain these results.",
          "kPa": "The bicarbonate of 22 mmol/L is consistent with the expected acute response to respiratory alkalosis. A fall in PCO₂ from 5.3 kPa to 4.0 kPa would lower bicarbonate by approximately 2 mmol/L, so an additional metabolic acidosis is not required to explain these results."
        }
      },
      {
        "id": "EXAM-0001-P1-O3",
        "text": {
          "mmHg": "Chronic respiratory alkalosis produces a larger reduction in bicarbonate as renal compensation develops over several days. At a PCO₂ of 30 mmHg, bicarbonate would typically be approximately 19–20 mmol/L. The measured bicarbonate of 22 mmol/L and short symptom duration favour an acute process.",
          "kPa": "Chronic respiratory alkalosis produces a larger reduction in bicarbonate as renal compensation develops over several days. At a PCO₂ of 4.0 kPa, bicarbonate would typically be approximately 19–20 mmol/L. The measured bicarbonate of 22 mmol/L and short symptom duration favour an acute process."
        }
      },
      {
        "id": "EXAM-0001-P1-O4",
        "text": {
          "mmHg": "The anion gap is 11 mmol/L, which is not elevated.",
          "kPa": "The anion gap is 11 mmol/L, which is not elevated."
        }
      }
    ],
    "errorLog": {
      "partConceptIds": [
        "respiratory_alkalosis_recognition"
      ]
    },
    "difficulty": 2
  },
  "EXAM-0001-P2": {
    "answer": {
      "mmHg": "Methaemoglobin biases conventional pulse oximeter readings towards approximately 85%, making SpO₂ unreliable.",
      "kPa": "Methaemoglobin biases conventional pulse oximeter readings towards approximately 85%, making SpO₂ unreliable."
    },
    "reasoning": {
      "mmHg": "Conventional pulse oximeters use two wavelengths of light to distinguish oxyhaemoglobin from deoxygenated haemoglobin. Methaemoglobin absorbs both wavelengths similarly, driving the absorption ratio towards a value that the device interprets as approximately 85%. As methaemoglobin increases, the displayed SpO₂ therefore tends towards 85%, rather than accurately reflecting oxygen saturation. It may underestimate or overestimate the actual functional saturation and cannot quantify the methaemoglobin percentage.",
      "kPa": "Conventional pulse oximeters use two wavelengths of light to distinguish oxyhaemoglobin from deoxygenated haemoglobin. Methaemoglobin absorbs both wavelengths similarly, driving the absorption ratio towards a value that the device interprets as approximately 85%. As methaemoglobin increases, the displayed SpO₂ therefore tends towards 85%, rather than accurately reflecting oxygen saturation. It may underestimate or overestimate the actual functional saturation and cannot quantify the methaemoglobin percentage."
    },
    "primaryObjective": "mechanism.explain",
    "criteria": [],
    "display": "resources_with_text_fallback",
    "resources": [],
    "rationales": [
      {
        "id": "EXAM-0001-P2-O2",
        "text": {
          "mmHg": "MetHb can make SpO₂ read falsely high or falsely low — it isn’t simply read as deoxygenated haemoglobin.",
          "kPa": "MetHb can make SpO₂ read falsely high or falsely low — it isn’t simply read as deoxygenated haemoglobin."
        }
      },
      {
        "id": "EXAM-0001-P2-O3",
        "text": {
          "mmHg": "SpO₂ tends towards ~85% rather than falling in proportion to the MetHb level.",
          "kPa": "SpO₂ tends towards ~85% rather than falling in proportion to the MetHb level."
        }
      },
      {
        "id": "EXAM-0001-P2-O4",
        "text": {
          "mmHg": "MetHb interferes with the SpO₂ reading — it isn’t simply excluded from the measurement",
          "kPa": "MetHb interferes with the SpO₂ reading — it isn’t simply excluded from the measurement"
        }
      }
    ],
    "errorLog": {
      "partConceptIds": [
        "methaemoglobinaemia_oxygen_measurements"
      ]
    },
    "difficulty": 3,
    "takeaway": {
      "mmHg": "Other important causes of methaemoglobinaemia include nitrates and nitrites, local anaesthetics, dapsone, and sulfonamides.",
      "kPa": "Other important causes of methaemoglobinaemia include nitrates and nitrites, local anaesthetics, dapsone, and sulfonamides."
    }
  },
  "EXAM-0001-P3": {
    "answer": {
      "mmHg": "Approximately 100 mmHg: arterial PO₂ is expected to remain preserved despite methaemoglobinaemia.",
      "kPa": "Approximately 13.3 kPa: arterial PO₂ is expected to remain preserved despite methaemoglobinaemia."
    },
    "reasoning": {
      "mmHg": "PaO₂ measures the partial pressure of oxygen dissolved in plasma. Methaemoglobinaemia impairs haemoglobin-mediated oxygen transport but does not itself prevent oxygen from passing from the alveoli into the blood. With otherwise normal pulmonary gas exchange, PaO₂ should therefore remain preserved. Approximately 100 mmHg is the best answer among the options, although hyperventilation may increase it somewhat. The SpO₂ of 86% cannot be used to infer PaO₂ because methaemoglobin distorts the pulse oximeter reading. A preserved PaO₂ does not exclude impaired oxygen delivery to the tissues.",
      "kPa": "PaO₂ measures the partial pressure of oxygen dissolved in plasma. Methaemoglobinaemia impairs haemoglobin-mediated oxygen transport but does not itself prevent oxygen from passing from the alveoli into the blood. With otherwise normal pulmonary gas exchange, PaO₂ should therefore remain preserved. Approximately 13.3 kPa is the best answer among the options, although hyperventilation may increase it somewhat. The SpO₂ of 86% cannot be used to infer PaO₂ because methaemoglobin distorts the pulse oximeter reading. A preserved PaO₂ does not exclude impaired oxygen delivery to the tissues."
    },
    "primaryObjective": "oxygenation.assess",
    "criteria": [],
    "display": "resources_with_text_fallback",
    "resources": [],
    "rationales": [
      {
        "id": "EXAM-0001-P3-O1",
        "text": {
          "mmHg": "This would represent marked arterial hypoxaemia. Methaemoglobinaemia impairs haemoglobin-mediated oxygen transport but does not itself lower the partial pressure of dissolved oxygen when pulmonary gas exchange is normal.",
          "kPa": "This would represent marked arterial hypoxaemia. Methaemoglobinaemia impairs haemoglobin-mediated oxygen transport but does not itself lower the partial pressure of dissolved oxygen when pulmonary gas exchange is normal."
        }
      },
      {
        "id": "EXAM-0001-P3-O2",
        "text": {
          "mmHg": "This may seem plausible from an SpO₂ of 86%, but that reading is distorted by methaemoglobin. The usual relationship between SpO₂ and PaO₂ cannot be applied here.",
          "kPa": "This may seem plausible from an SpO₂ of 86%, but that reading is distorted by methaemoglobin. The usual relationship between SpO₂ and PaO₂ cannot be applied here."
        }
      },
      {
        "id": "EXAM-0001-P3-O4",
        "text": {
          "mmHg": "This is not achievable while breathing room air at normal atmospheric pressure. Hyperventilation can increase alveolar PO₂ modestly, but even inspired humidified oxygen has a PO₂ of only approximately 150 mmHg at sea level.",
          "kPa": "This is not achievable while breathing room air at normal atmospheric pressure. Hyperventilation can increase alveolar PO₂ modestly, but even inspired humidified oxygen has a PO₂ of only approximately 20.0 kPa at sea level."
        }
      }
    ],
    "errorLog": {
      "partConceptIds": [
        "methaemoglobinaemia_oxygen_measurements"
      ]
    },
    "difficulty": 3
  },
  "EXAM-0001-P4": {
    "answer": {
      "mmHg": "G6PD deficiency is relevant because methylene blue may be ineffective and can cause haemolysis.",
      "kPa": "G6PD deficiency is relevant because methylene blue may be ineffective and can cause haemolysis."
    },
    "reasoning": {
      "mmHg": "Methylene blue requires NADPH to be converted into its active reducing form, which converts methaemoglobin back into functional haemoglobin. G6PD-deficient red cells have a reduced capacity to generate NADPH. Methylene blue may therefore be ineffective, while its oxidant effects can cause haemolysis and worsen methaemoglobinaemia. Known G6PD deficiency is a contraindication in methylene blue prescribing information. Seek urgent toxicology advice regarding alternative treatment when antidotal therapy is required.",
      "kPa": "Methylene blue requires NADPH to be converted into its active reducing form, which converts methaemoglobin back into functional haemoglobin. G6PD-deficient red cells have a reduced capacity to generate NADPH. Methylene blue may therefore be ineffective, while its oxidant effects can cause haemolysis and worsen methaemoglobinaemia. Known G6PD deficiency is a contraindication in methylene blue prescribing information. Seek urgent toxicology advice regarding alternative treatment when antidotal therapy is required."
    },
    "primaryObjective": "clinical_application.gas_guided",
    "criteria": [],
    "display": "resources_with_text_fallback",
    "resources": [],
    "rationales": [
      {
        "id": "EXAM-0001-P4-O2",
        "text": {
          "mmHg": "The low PCO₂ indicates increased ventilation, rather than failure to eliminate CO₂. His cyanosis and low SpO₂ reflect methaemoglobinaemia; these findings alone do not establish a need for intubation.",
          "kPa": "The low PCO₂ indicates increased ventilation, rather than failure to eliminate CO₂. His cyanosis and low SpO₂ reflect methaemoglobinaemia; these findings alone do not establish a need for intubation."
        }
      },
      {
        "id": "EXAM-0001-P4-O3",
        "text": {
          "mmHg": "Supplemental oxygen should be given to support oxygen delivery by maximising oxygenation of functional haemoglobin and increasing dissolved oxygen. It does not directly reverse methaemoglobin formation, but remains useful supportive treatment.",
          "kPa": "Supplemental oxygen should be given to support oxygen delivery by maximising oxygenation of functional haemoglobin and increasing dissolved oxygen. It does not directly reverse methaemoglobin formation, but remains useful supportive treatment."
        }
      },
      {
        "id": "EXAM-0001-P4-O4",
        "text": {
          "mmHg": "Repeat treatment should be guided by clinical response and methaemoglobin levels measured by co-oximetry, rather than an SpO₂ target. Methylene blue itself can transiently lower the pulse oximeter reading, and excessive dosing can cause haemolysis and worsen methaemoglobinaemia.",
          "kPa": "Repeat treatment should be guided by clinical response and methaemoglobin levels measured by co-oximetry, rather than an SpO₂ target. Methylene blue itself can transiently lower the pulse oximeter reading, and excessive dosing can cause haemolysis and worsen methaemoglobinaemia."
        }
      }
    ],
    "errorLog": {
      "partConceptIds": [
        "methaemoglobinaemia_management"
      ]
    },
    "difficulty": 3,
    "takeaway": {
      "mmHg": "If SpO2 appears to be stuck around 85% despite high-flow oxygen, especially with a normal PaO2, think methaemoglobinaemia",
      "kPa": "If SpO2 appears to be stuck around 85% despite high-flow oxygen, especially with a normal PaO2, think methaemoglobinaemia"
    }
  },
  "EXAM-0002-P1": {
    "answer": {
      "mmHg": "Respiratory acidosis.",
      "kPa": "Respiratory acidosis."
    },
    "reasoning": {
      "mmHg": "The pH is acidaemic. PaCO2 is markedly elevated, suggesting a respiratory acidifying process: retained carbon dioxide increases hydrogen ion concentration and lowers pH.",
      "kPa": "The pH is acidaemic. PaCO2 is markedly elevated, suggesting a respiratory acidifying process: retained carbon dioxide increases hydrogen ion concentration and lowers pH."
    },
    "primaryObjective": "acid_base.primary_process",
    "criteria": [
      {
        "id": "identify_respiratory_acidosis",
        "label": "Identifies respiratory acidosis"
      }
    ],
    "display": "resources_with_text_fallback",
    "resources": [],
    "rationales": [],
    "errorLog": {
      "criterionConceptIds": {
        "identify_respiratory_acidosis": [
          "respiratory_acidosis_recognition"
        ]
      }
    },
    "difficulty": 1
  },
  "EXAM-0002-P2": {
    "answer": {
      "mmHg": "His O2 saturation is approximately 80–85%.",
      "kPa": "His O2 saturation is approximately 80–85%."
    },
    "reasoning": {
      "mmHg": "A PaO2 of 50 mmHg corresponds to approximately 80% SaO2 on the standard oxygen-haemoglobin dissociation curve. Below about 60 mmHg, the curve is steep, so relatively small falls in PaO2 cause substantial falls in saturation.",
      "kPa": "A PaO2 of 6.7 kPa corresponds to approximately 80% SaO2 on the standard oxygen-haemoglobin dissociation curve. Below about 8.0 kPa, the curve is steep, so relatively small falls in PaO2 cause substantial falls in saturation."
    },
    "primaryObjective": "oxygenation.assess",
    "criteria": [],
    "display": "resources_with_text_fallback",
    "resources": [],
    "rationales": [],
    "errorLog": {
      "partConceptIds": [
        "oxyhaemoglobin_dissociation_curve"
      ]
    },
    "difficulty": 3,
    "takeaway": {
      "mmHg": "For the standard O2-Hb dissociation curve (approximates):\n- PaO2 60 mmHg → SaO2 ≈ 90%\n- PaO2 50 mmHg → SaO2 ≈ 80–85%\n- PaO2 40 mmHg → SaO2 ≈ 75%\n- PaO2 27 mmHg → SaO2 ≈ 50%",
      "kPa": "For the standard O2-Hb dissociation curve (approximates):\n- PaO2 8.0 kPa → SaO2 ≈ 90%\n- PaO2 6.7 kPa → SaO2 ≈ 80–85%\n- PaO2 5.3 kPa → SaO2 ≈ 75%\n- PaO2 3.6 kPa → SaO2 ≈ 50%"
    }
  },
  "EXAM-0002-P3": {
    "answer": {
      "mmHg": "Sedative intoxication, brainstem stroke, and high cervical spinal cord injury.",
      "kPa": "Sedative intoxication, brainstem stroke, and high cervical spinal cord injury."
    },
    "reasoning": {
      "mmHg": "Acute pulmonary embolism more commonly causes hyperventilation and an acute respiratory alkalosis. Salicylate toxicity classically produces respiratory alkalosis, often with a concurrent high-anion-gap metabolic acidosis. Stable severe COPD with chronic CO₂ retention produces a chronic respiratory acidosis with renal bicarbonate compensation rather than an isolated acute respiratory acidosis.",
      "kPa": "Acute pulmonary embolism more commonly causes hyperventilation and an acute respiratory alkalosis. Salicylate toxicity classically produces respiratory alkalosis, often with a concurrent high-anion-gap metabolic acidosis. Stable severe COPD with chronic CO₂ retention produces a chronic respiratory acidosis with renal bicarbonate compensation rather than an isolated acute respiratory acidosis."
    },
    "primaryObjective": "aetiology_diagnosis.identify",
    "criteria": [],
    "display": "resources_with_text_fallback",
    "resources": [],
    "rationales": [],
    "errorLog": {
      "partConceptIds": [
        "acute_respiratory_acidosis_causes"
      ]
    },
    "difficulty": 3
  },
  "EXAM-0002-P4": {
    "answer": {
      "mmHg": "Worsening V/Q mismatch and the Haldane effect.",
      "kPa": "Worsening V/Q mismatch and the Haldane effect."
    },
    "reasoning": {
      "mmHg": "Excess oxygen can reverse hypoxic pulmonary vasoconstriction, increasing perfusion of poorly ventilated lung and worsening V/Q mismatch. This reduces effective CO2 elimination.\n\nThe Haldane effect also raises CO2: oxygenated haemoglobin carries less CO2, so oxygenation releases CO2 into the blood. Patients with limited ventilatory capacity may not increase ventilation enough to eliminate this additional CO2.",
      "kPa": "Excess oxygen can reverse hypoxic pulmonary vasoconstriction, increasing perfusion of poorly ventilated lung and worsening V/Q mismatch. This reduces effective CO2 elimination.\n\nThe Haldane effect also raises CO2: oxygenated haemoglobin carries less CO2, so oxygenation releases CO2 into the blood. Patients with limited ventilatory capacity may not increase ventilation enough to eliminate this additional CO2."
    },
    "primaryObjective": "mechanism.explain",
    "criteria": [
      {
        "id": "identify_vq_mismatch",
        "label": "Identifies worsening V/Q mismatch or reduced CO2 elimination"
      },
      {
        "id": "identify_haldane_effect",
        "label": "Identifies the Haldane effect or oxygen-related CO2 offloading"
      }
    ],
    "display": "resources_with_text_fallback",
    "resources": [],
    "rationales": [],
    "errorLog": {
      "criterionConceptIds": {
        "identify_vq_mismatch": [
          "oxygen_induced_hypercapnia_mechanisms"
        ],
        "identify_haldane_effect": [
          "oxygen_induced_hypercapnia_mechanisms"
        ]
      }
    },
    "difficulty": 4,
    "takeaway": {
      "mmHg": "Loss of hypoxic drive is commonly blamed for oxygen-induced hypercapnia, but it is not the main mechanism.",
      "kPa": "Loss of hypoxic drive is commonly blamed for oxygen-induced hypercapnia, but it is not the main mechanism."
    }
  },
  "EXAM-0003-P1": {
    "answer": {
      "mmHg": "Mixed metabolic acidosis and respiratory acidosis.",
      "kPa": "Mixed metabolic acidosis and respiratory acidosis."
    },
    "reasoning": {
      "mmHg": "The pH of 7.14 indicates acidaemia. Bicarbonate of 20 mmol/L supports metabolic acidosis. Using Winter's formula, the expected PCO2 is approximately 38 mmHg, with a range of 36-40 mmHg. The measured PCO2 of 61 mmHg is substantially above this range, supporting an additional primary respiratory acidosis. The reduced bicarbonate is not compensation for respiratory acidosis, which would ordinarily increase bicarbonate.\n\nSummary: mixed metabolic and respiratory acidosis.",
      "kPa": "The pH of 7.14 indicates acidaemia. Bicarbonate of 20 mmol/L supports metabolic acidosis. Using Winter's formula, the expected PCO2 is approximately 38 mmHg, with a range of 36-40 mmHg. The measured PCO2 of 8.1 kPa is substantially above this range, supporting an additional primary respiratory acidosis. The reduced bicarbonate is not compensation for respiratory acidosis, which would ordinarily increase bicarbonate.\n\nSummary: mixed metabolic and respiratory acidosis."
    },
    "primaryObjective": "mixed_disorders.recognise",
    "criteria": [
      {
        "id": "identify_metabolic_acidosis",
        "label": "Identifies concurrent metabolic acidosis"
      },
      {
        "id": "identify_respiratory_acidosis",
        "label": "Identifies concurrent respiratory acidosis"
      }
    ],
    "display": "resources_with_text_fallback",
    "resources": [],
    "rationales": [],
    "errorLog": {
      "criterionConceptIds": {
        "identify_metabolic_acidosis": [
          "metabolic_acidosis_recognition"
        ],
        "identify_respiratory_acidosis": [
          "respiratory_acidosis_recognition"
        ]
      }
    },
    "difficulty": 3,
    "takeaway": {
      "mmHg": "When PCO2 is raised and bicarbonate is reduced in an acidotic patient, consider two primary acidifying processes.",
      "kPa": "When PCO2 is raised and bicarbonate is reduced in an acidotic patient, consider two primary acidifying processes."
    }
  },
  "EXAM-0003-P2": {
    "answer": {
      "mmHg": "The predicted PCO2 is 38 mmHg; the expected physiological range is 36 mmHg to 40 mmHg.",
      "kPa": "The predicted PCO2 is 5.1 kPa; the expected physiological range is 4.8 kPa to 5.3 kPa."
    },
    "reasoning": {
      "mmHg": "Using Winter's formula: expected PCO2 = (1.5 x HCO3-) + 8 +/-2 mmHg.With HCO₃⁻ = 20 mmol/L, the predicted PCO₂ is 38 mmHg, with an expected range of 36–40 mmHg.",
      "kPa": "Using Winter's formula: expected PCO2 = (1.5 x HCO3-) + 8 +/-2 mmHg.With HCO₃⁻ = 20 mmol/L, the predicted PCO₂ is 38 mmHg, with an expected range of 36–40 mmHg."
    },
    "primaryObjective": "compensation.assess",
    "criteria": [],
    "display": "resources_with_text_fallback",
    "resources": [
      {
        "kind": "compensation",
        "result": {
          "targetAnalyte": "paco2",
          "measuredValue": 61.0,
          "unit": "mmHg",
          "comparisonBands": [
            {
              "id": "reference",
              "role": "reference",
              "kindKey": "reference",
              "labelKey": "reference_range",
              "low": 35.0,
              "high": 45.0,
              "midpoint": 40.0
            },
            {
              "id": "primary_expected",
              "role": "expected",
              "kindKey": "primary_expected",
              "labelKey": "expected_range",
              "low": 36.0,
              "high": 40.0,
              "midpoint": 38.0
            }
          ],
          "comparisons": [
            {
              "bandId": "reference",
              "relationship": "above"
            },
            {
              "bandId": "primary_expected",
              "relationship": "above"
            }
          ],
          "interpretationKey": "markedly_above_expected_range",
          "calculation": {
            "ruleKey": "winter",
            "displayLines": [
              "Winter's Formula: (1.5 × 20) + 8 = 38 mmHg",
              "Expected PaCO2: 36 – 40 mmHg",
              "Measured PaCO2: 61 mmHg"
            ]
          },
          "primaryExpectedBandId": "primary_expected"
        },
        "measuredPaCO2MmHg": 61
      }
    ],
    "rationales": [],
    "errorLog": {
      "partConceptIds": [
        "respiratory_compensation_metabolic_acidosis"
      ]
    },
    "difficulty": 3
  },
  "EXAM-0003-P3": {
    "answer": {
      "mmHg": "Reduced alveolar ventilation due to central nervous system depression.",
      "kPa": "Reduced alveolar ventilation due to central nervous system depression."
    },
    "reasoning": {
      "mmHg": "Central nervous system depression can reduce respiratory drive and alveolar ventilation. Reduced CO2 clearance raises PCO2, providing a plausible explanation for the respiratory component in this deeply unconscious patient.",
      "kPa": "Central nervous system depression can reduce respiratory drive and alveolar ventilation. Reduced CO2 clearance raises PCO2, providing a plausible explanation for the respiratory component in this deeply unconscious patient."
    },
    "primaryObjective": "mechanism.explain",
    "criteria": [],
    "display": "resources_with_text_fallback",
    "resources": [],
    "rationales": [],
    "errorLog": {
      "partConceptIds": [
        "acute_respiratory_acidosis_causes"
      ]
    },
    "difficulty": 3,
    "takeaway": {
      "mmHg": "Identify the mechanism supported by the case without assuming that it explains every component of a mixed disorder.",
      "kPa": "Identify the mechanism supported by the case without assuming that it explains every component of a mixed disorder."
    }
  },
  "EXAM-0004-P1": {
    "answer": {
      "mmHg": "This is a mixed disorder (HAGMA + Respiratory Alkalosis)",
      "kPa": "This is a mixed disorder (HAGMA + Respiratory Alkalosis)"
    },
    "reasoning": {
      "mmHg": "The expected PCO2 is 26 mmHg, while the measured PCO2 is 18 mmHg. This does not fit isolated respiratory compensation and indicates an additional respiratory alkalosis. The elevated anion gap of 25 also suggests a HAGMA. The delta ratio does not suggest an additional metabolic process to this HAGMA.",
      "kPa": "The expected PCO2 is 3.5 kPa, while the measured PCO2 is 2.4 kPa. This does not fit isolated respiratory compensation and indicates an additional respiratory alkalosis. The elevated anion gap of 25 also suggests a HAGMA. The delta ratio does not suggest an additional metabolic process to this HAGMA."
    },
    "primaryObjective": "mixed_disorders.recognise",
    "criteria": [
      {
        "id": "identify_hagma",
        "label": "Identifies high anion gap metabolic acidosis"
      },
      {
        "id": "identify_respiratory_alkalosis",
        "label": "Identifies additional respiratory alkalosis"
      }
    ],
    "display": "resources_with_text_fallback",
    "resources": [
      {
        "kind": "compensation",
        "result": {
          "targetAnalyte": "paco2",
          "measuredValue": 18.0,
          "unit": "mmHg",
          "comparisonBands": [
            {
              "id": "reference",
              "role": "reference",
              "kindKey": "reference",
              "labelKey": "reference_range",
              "low": 35.0,
              "high": 45.0,
              "midpoint": 40.0
            },
            {
              "id": "primary_expected",
              "role": "expected",
              "kindKey": "primary_expected",
              "labelKey": "expected_range",
              "low": 24.0,
              "high": 28.0,
              "midpoint": 26.0
            }
          ],
          "comparisons": [
            {
              "bandId": "reference",
              "relationship": "below"
            },
            {
              "bandId": "primary_expected",
              "relationship": "below"
            }
          ],
          "interpretationKey": "below_expected_range",
          "calculation": {
            "ruleKey": "winter",
            "displayLines": [
              "Winter's Formula: (1.5 × 12) + 8 = 26 mmHg",
              "Expected PaCO2: 24 – 28 mmHg",
              "Measured PaCO2: 18 mmHg"
            ]
          },
          "primaryExpectedBandId": "primary_expected"
        },
        "measuredPaCO2MmHg": 18
      }
    ],
    "rationales": [],
    "errorLog": {
      "criterionConceptIds": {
        "identify_hagma": [
          "hagma_recognition"
        ],
        "identify_respiratory_alkalosis": [
          "respiratory_alkalosis_recognition"
        ]
      }
    },
    "difficulty": 4
  },
  "EXAM-0004-P2": {
    "answer": {
      "mmHg": "Opioid toxicity",
      "kPa": "Opioid toxicity"
    },
    "reasoning": {
      "mmHg": "The gas demonstrates a HAGMA with a concurrent respiratory alkalosis. Sepsis, salicylate toxicity and acute liver failure can all produce this combination. Opioid toxicity instead causes respiratory depression and therefore tends to produce respiratory acidosis.",
      "kPa": "The gas demonstrates a HAGMA with a concurrent respiratory alkalosis. Sepsis, salicylate toxicity and acute liver failure can all produce this combination. Opioid toxicity instead causes respiratory depression and therefore tends to produce respiratory acidosis."
    },
    "primaryObjective": "aetiology_diagnosis.identify",
    "criteria": [],
    "display": "resources_with_text_fallback",
    "resources": [],
    "rationales": [
      {
        "id": "EXAM-0004-P2-O1",
        "text": {
          "mmHg": "Sepsis can cause lactic acidosis while systemic illness and respiratory stimulation produce a concurrent respiratory alkalosis.",
          "kPa": "Sepsis can cause lactic acidosis while systemic illness and respiratory stimulation produce a concurrent respiratory alkalosis."
        }
      },
      {
        "id": "EXAM-0004-P2-O2",
        "text": {
          "mmHg": "Salicylate toxicity classically produces respiratory alkalosis together with a HAGMA.",
          "kPa": "Salicylate toxicity classically produces respiratory alkalosis together with a HAGMA."
        }
      },
      {
        "id": "EXAM-0004-P2-O3",
        "text": {
          "mmHg": "Acute liver failure may produce respiratory alkalosis and HAGMA, including from impaired lactate clearance.",
          "kPa": "Acute liver failure may produce respiratory alkalosis and HAGMA, including from impaired lactate clearance."
        }
      }
    ],
    "errorLog": {
      "partConceptIds": [
        "hagma_respiratory_alkalosis_causes"
      ]
    },
    "difficulty": 3
  },
  "EXAM-0004-P3": {
    "answer": {
      "mmHg": "A falling lactate is reassuring, but the trend must be interpreted alongside the patient's clinical response.",
      "kPa": "A falling lactate is reassuring, but the trend must be interpreted alongside the patient's clinical response."
    },
    "reasoning": {
      "mmHg": "A substantial fall in lactate after treatment is reassuring, but lactate is not a direct measure of tissue perfusion and should not be interpreted in isolation. Persistent elevation may reflect ongoing hypoperfusion, adrenergic stimulation, impaired clearance or other causes. Likewise, a falling lactate does not prove that resuscitation is complete. The trend should be interpreted alongside the patient's haemodynamics and overall clinical response.",
      "kPa": "A substantial fall in lactate after treatment is reassuring, but lactate is not a direct measure of tissue perfusion and should not be interpreted in isolation. Persistent elevation may reflect ongoing hypoperfusion, adrenergic stimulation, impaired clearance or other causes. Likewise, a falling lactate does not prove that resuscitation is complete. The trend should be interpreted alongside the patient's haemodynamics and overall clinical response."
    },
    "primaryObjective": "clinical_application.gas_guided",
    "criteria": [],
    "display": "resources_with_text_fallback",
    "resources": [],
    "rationales": [
      {
        "id": "EXAM-0004-P3-O2",
        "text": {
          "mmHg": "Persistent lactate elevation does not necessarily indicate ongoing tissue hypoperfusion.",
          "kPa": "Persistent lactate elevation does not necessarily indicate ongoing tissue hypoperfusion."
        }
      },
      {
        "id": "EXAM-0004-P3-O3",
        "text": {
          "mmHg": "Lactate improvement alone cannot confirm adequate resuscitation.",
          "kPa": "Lactate improvement alone cannot confirm adequate resuscitation."
        }
      },
      {
        "id": "EXAM-0004-P3-O4",
        "text": {
          "mmHg": "Serial lactate measurements can remain useful for assessing trends after treatment begins.",
          "kPa": "Serial lactate measurements can remain useful for assessing trends after treatment begins."
        }
      }
    ],
    "errorLog": {
      "partConceptIds": [
        "lactate_trend_interpretation"
      ]
    },
    "difficulty": 2.0
  },
  "EXAM-0005-P1": {
    "answer": {
      "mmHg": "A-a gradient is 534 mmHg",
      "kPa": "A-a gradient is 71.2 kPa"
    },
    "reasoning": {
      "mmHg": "A-a gradient is 534 mmHg",
      "kPa": "A-a gradient is 71.2 kPa"
    },
    "primaryObjective": "oxygenation.assess",
    "criteria": [],
    "display": "resources_with_text_fallback",
    "resources": [
      {
        "kind": "aa_gradient",
        "result": {
          "formulaVersion": "alveolar_gas_v1",
          "canonicalUnit": "mmHg",
          "inputs": {
            "fio2Fraction": 1.0,
            "measuredPaCO2MmHg": 81.0,
            "measuredPaO2MmHg": 78.0
          },
          "assumptions": {
            "barometricPressureMmHg": 760.0,
            "waterVapourPressureMmHg": 47.0,
            "respiratoryQuotient": 0.8
          },
          "calculated": {
            "inspiredOxygenPressureMmHg": 713.0,
            "co2CorrectionMmHg": 101.25,
            "alveolarOxygenPressureMmHg": 611.75,
            "aaGradientMmHg": 533.75
          },
          "interpretation": {
            "key": "raised_aa_gradient",
            "tone": "raised",
            "label": "Raised A-a gradient",
            "explanation": "This is profoundly elevated and indicates severe impairment of oxygen transfer."
          }
        }
      }
    ],
    "rationales": [],
    "errorLog": {
      "partConceptIds": [
        "aa_gradient_calculation_interpretation"
      ]
    },
    "difficulty": 2.0
  },
  "EXAM-0005-P2": {
    "answer": {
      "mmHg": "12 mmHg",
      "kPa": "1.6 kPa"
    },
    "reasoning": {
      "mmHg": "Normal Gradient Estimate (in mmHg) = (Age/4) + 4 -> (32/4) + 4 = 12 mmHg.\n\nThis equation only applies when the patient is breathing room air.",
      "kPa": "Normal Gradient Estimate (in mmHg) = (Age/4) + 4 -> (32/4) + 4 = 1.6 kPa.\n\nThis equation only applies when the patient is breathing room air."
    },
    "primaryObjective": "oxygenation.assess",
    "criteria": [],
    "display": "resources_with_text_fallback",
    "resources": [],
    "rationales": [],
    "errorLog": {
      "partConceptIds": [
        "aa_gradient_calculation_interpretation"
      ]
    },
    "difficulty": 3.0
  },
  "EXAM-0005-P3": {
    "answer": {
      "mmHg": "There is severe impairment of oxygen transfer.",
      "kPa": "There is severe impairment of oxygen transfer."
    },
    "reasoning": {
      "mmHg": "Her calculated A-a gradient is approximately 534 mmHg. This is profoundly elevated and indicates severe impairment of oxygen transfer.",
      "kPa": "Her calculated A-a gradient is approximately 71.2 kPa. This is profoundly elevated and indicates severe impairment of oxygen transfer."
    },
    "primaryObjective": "oxygenation.assess",
    "criteria": [],
    "display": "resources_with_text_fallback",
    "resources": [],
    "rationales": [
      {
        "id": "EXAM-0005-P3-O2",
        "text": {
          "mmHg": "Hypercapnia lowers alveolar oxygen tension, but hypoventilation alone does not cause a markedly elevated A-a gradient. The very large gradient indicates an additional impairment in oxygen transfer.",
          "kPa": "Hypercapnia lowers alveolar oxygen tension, but hypoventilation alone does not cause a markedly elevated A-a gradient. The very large gradient indicates an additional impairment in oxygen transfer."
        }
      },
      {
        "id": "EXAM-0005-P3-O3",
        "text": {
          "mmHg": "PaO2 must be interpreted in the context of FiO2. A PaO2 of 78 mmHg on an FiO2 of 1.0 represents severe oxygenation impairment despite being above 60 mmHg.",
          "kPa": "PaO2 must be interpreted in the context of FiO2. A PaO2 of 10.4 kPa on an FiO2 of 1.0 represents severe oxygenation impairment despite being above 8.0 kPa."
        }
      },
      {
        "id": "EXAM-0005-P3-O4",
        "text": {
          "mmHg": "The P/F ratio remains interpretable at an FiO2 of 1.0. Here, PaO2 78 mmHg on FiO2 1.0 gives a P/F ratio of approximately 78, indicating severe impairment of oxygenation.",
          "kPa": "The P/F ratio remains interpretable at an FiO2 of 1.0. Here, PaO2 10.4 kPa on FiO2 1.0 gives a P/F ratio of approximately 78, indicating severe impairment of oxygenation."
        }
      }
    ],
    "errorLog": {
      "partConceptIds": [
        "aa_gradient_calculation_interpretation"
      ]
    },
    "difficulty": 3.0
  },
  "EXAM-0005-P4": {
    "answer": {
      "mmHg": "Mixed respiratory and metabolic acidosis, with a lactic component.",
      "kPa": "Mixed respiratory and metabolic acidosis, with a lactic component."
    },
    "reasoning": {
      "mmHg": "The pH of 6.91 indicates profound acidaemia. The reduced bicarbonate of 16 mmol/L and lactate of 5.6 mmol/L support metabolic acidosis with a lactic component.\n\nWinter's formula: expected PaCO2 = 1.5 x 16 + 8 = 32 mmHg, with an expected range of 30 mmHg to 34 mmHg. The measured PaCO2 of 81 mmHg is substantially above this range, indicating an additional primary respiratory acidosis.\n\nAnion gap = Na - Cl - HCO3 = 140 - 110 - 16 = 14 mmol/L. This is only mildly elevated relative to the assumed normal gap of 12 mmol/L. Albumin contributes substantially to the normal anion gap; a reduced albumin can mask a larger accumulation of unmeasured anions. Albumin is not supplied, so an albumin-corrected gap cannot be calculated.\n\nDelta ratio = (14 - 12) / (24 - 16) = 2/8 = 0.25. Under conventional assumptions, this low ratio suggests a normal-gap metabolic component. However, pregnancy normally produces respiratory alkalosis with renal compensation, lowering baseline bicarbonate to approximately 18-22 mmol/L. Using 24 mmol/L therefore overestimates the fall from her likely pregnancy baseline. The small uncorrected gap elevation and unknown albumin further limit interpretation. An additional NAGMA is possible, but cannot be established confidently from this ratio alone.\n\nSummary: mixed respiratory and metabolic acidosis, with a lactic component. Specific HAGMA/NAGMA classification is less certain.",
      "kPa": "The pH of 6.91 indicates profound acidaemia. The reduced bicarbonate of 16 mmol/L and lactate of 5.6 mmol/L support metabolic acidosis with a lactic component.\n\nWinter's formula: expected PaCO2 = 1.5 x 16 + 8 = 4.3 kPa, with an expected range of 4.0 kPa to 4.5 kPa. The measured PaCO2 of 10.8 kPa is substantially above this range, indicating an additional primary respiratory acidosis.\n\nAnion gap = Na - Cl - HCO3 = 140 - 110 - 16 = 14 mmol/L. This is only mildly elevated relative to the assumed normal gap of 12 mmol/L. Albumin contributes substantially to the normal anion gap; a reduced albumin can mask a larger accumulation of unmeasured anions. Albumin is not supplied, so an albumin-corrected gap cannot be calculated.\n\nDelta ratio = (14 - 12) / (24 - 16) = 2/8 = 0.25. Under conventional assumptions, this low ratio suggests a normal-gap metabolic component. However, pregnancy normally produces respiratory alkalosis with renal compensation, lowering baseline bicarbonate to approximately 18-22 mmol/L. Using 24 mmol/L therefore overestimates the fall from her likely pregnancy baseline. The small uncorrected gap elevation and unknown albumin further limit interpretation. An additional NAGMA is possible, but cannot be established confidently from this ratio alone.\n\nSummary: mixed respiratory and metabolic acidosis, with a lactic component. Specific HAGMA/NAGMA classification is less certain."
    },
    "primaryObjective": "mixed_disorders.recognise",
    "criteria": [
      {
        "id": "calculate_expected_pco2",
        "label": "Calculates expected PaCO2 with correct interpretation"
      },
      {
        "id": "calculate_anion_gap",
        "label": "Calculates the anion gap with correct interpretation"
      },
      {
        "id": "calculate_delta_ratio",
        "label": "Calculates the delta ratio with correct interpretation"
      },
      {
        "id": "interpret_triple_disorder",
        "label": "Identifies mixed respiratory and metabolic acidosis"
      }
    ],
    "display": "resources_with_text_fallback",
    "resources": [],
    "rationales": [],
    "errorLog": {
      "criterionConceptIds": {
        "calculate_expected_pco2": [
          "respiratory_compensation_metabolic_acidosis"
        ],
        "calculate_anion_gap": [
          "anion_gap_calculation_interpretation"
        ],
        "calculate_delta_ratio": [
          "delta_ratio_calculation_interpretation"
        ],
        "interpret_triple_disorder": [
          "mixed_acid_base_disorder_recognition"
        ]
      }
    },
    "difficulty": 3.0,
    "takeaway": {
      "mmHg": "The body's buffer system is quite substantial. To achieve a pH this low usually requires multiple acidotic processes occuring simultaneously",
      "kPa": "The body's buffer system is quite substantial. To achieve a pH this low usually requires multiple acidotic processes occuring simultaneously"
    }
  }
};
