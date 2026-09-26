import type { ExamQuestion } from "./sittingTypes";

// GENERATED development-only assessment snapshot: EXAM-0001 a1, EXAM-0002 a2, EXAM-0003 a2.
// Refresh from the private content repository: py -B -m generator.exam_preview
// Keep the DEV import guard. No rubric, keys, feedback, resources or difficulty.
// Canonical IDs and authored option order preserved; "concept" means text input, not grading.
export const demoQuestions: ExamQuestion[] = [
  {
    "id": "EXAM-0001",
    "scenario": "A 23-year-old male presents to triage breathless. He is visibly cyanotic and has increased work of breathing. His vitals are RR 32/min, SpO2 86% on room air, HR 104 bpm, and BP 128/76 mmHg. He is alert, and his lungs are clear on auscultation. He tells you that he has been using 'poppers' for the last several hours.",
    "tables": [
      {
        "id": "EXAM-0001-gas",
        "heading": "Initial VBG",
        "grouping": "Patient 1 · presentation · venous blood",
        "rows": [
          {
            "id": "EXAM-0001-ph",
            "label": "pH",
            "value": 7.49,
            "unit": "",
            "primary": true,
            "oxygenation": false,
            "pressure": false,
            "refLow": 7.35,
            "refHigh": 7.45
          },
          {
            "id": "EXAM-0001-pco2",
            "label": "PaCO2",
            "value": 30,
            "unit": "mmHg",
            "primary": true,
            "oxygenation": false,
            "pressure": true,
            "refLow": 35,
            "refHigh": 45
          },
          {
            "id": "EXAM-0001-hco3",
            "label": "HCO3",
            "value": 22,
            "unit": "mmol/L",
            "primary": true,
            "oxygenation": false,
            "pressure": false,
            "refLow": 22,
            "refHigh": 26
          },
          {
            "id": "EXAM-0001-na",
            "label": "Na",
            "value": 138,
            "unit": "mmol/L",
            "primary": false,
            "oxygenation": false,
            "pressure": false,
            "refLow": 135,
            "refHigh": 145
          },
          {
            "id": "EXAM-0001-k",
            "label": "K",
            "value": 3.8,
            "unit": "mmol/L",
            "primary": false,
            "oxygenation": false,
            "pressure": false,
            "refLow": 3.5,
            "refHigh": 5.0
          },
          {
            "id": "EXAM-0001-cl",
            "label": "Cl",
            "value": 105,
            "unit": "mmol/L",
            "primary": false,
            "oxygenation": false,
            "pressure": false,
            "refLow": 98,
            "refHigh": 106
          },
          {
            "id": "EXAM-0001-methb",
            "label": "MetHb",
            "value": 15.8,
            "unit": "%",
            "primary": false,
            "oxygenation": false,
            "pressure": false,
            "refLow": 0,
            "refHigh": 1.5
          },
          {
            "id": "EXAM-0001-glucose",
            "label": "Glucose",
            "value": 4.8,
            "unit": "mmol/L",
            "primary": false,
            "oxygenation": false,
            "pressure": false,
            "refLow": 3.9,
            "refHigh": 7.8
          },
          {
            "id": "EXAM-0001-lactate",
            "label": "Lactate",
            "value": 1.8,
            "unit": "mmol/L",
            "primary": false,
            "oxygenation": false,
            "pressure": false,
            "refLow": 0.5,
            "refHigh": 2.0
          }
        ]
      }
    ],
    "parts": [
      {
        "id": "EXAM-0001-P1",
        "kind": "single",
        "prompt": "What is the acid-base process?",
        "marks": 1,
        "instruction": "Select one",
        "options": [
          {
            "id": "EXAM-0001-P1-O1",
            "text": "Acute respiratory alkalosis without an additional metabolic disturbance"
          },
          {
            "id": "EXAM-0001-P1-O2",
            "text": "Respiratory alkalosis with metabolic acidosis"
          },
          {
            "id": "EXAM-0001-P1-O3",
            "text": "Chronic respiratory alkalosis with renal compensation"
          },
          {
            "id": "EXAM-0001-P1-O4",
            "text": "High anion gap metabolic acidosis with respiratory compensation"
          }
        ]
      },
      {
        "id": "EXAM-0001-P2",
        "kind": "single",
        "prompt": "Which of the following is correct regarding the SpO₂?",
        "marks": 1,
        "instruction": "Select one",
        "options": [
          {
            "id": "EXAM-0001-P2-O1",
            "text": "It is biased towards approximately 85% as methaemoglobin increases, irrespective of the actual functional oxygen saturation"
          },
          {
            "id": "EXAM-0001-P2-O2",
            "text": "It underestimates oxygen saturation because methaemoglobin is detected as deoxygenated haemoglobin"
          },
          {
            "id": "EXAM-0001-P2-O3",
            "text": "It falls proportionally as the methaemoglobin concentration increases"
          },
          {
            "id": "EXAM-0001-P2-O4",
            "text": "It measures the saturation of the remaining functional haemoglobin, excluding methaemoglobin"
          }
        ]
      },
      {
        "id": "EXAM-0001-P3",
        "kind": "single",
        "prompt": "Assuming otherwise normal gas exchange, which of the following best predicts this patient’s arterial PO₂ on room air at sea level?",
        "marks": 1,
        "instruction": "Select one",
        "options": [
          {
            "id": "EXAM-0001-P3-O1",
            "text": "Approximately 40 mmHg",
            "textKpa": "Approximately 5.3 kPa"
          },
          {
            "id": "EXAM-0001-P3-O2",
            "text": "Approximately 55 mmHg",
            "textKpa": "Approximately 7.3 kPa"
          },
          {
            "id": "EXAM-0001-P3-O3",
            "text": "Approximately 100 mmHg",
            "textKpa": "Approximately 13.3 kPa"
          },
          {
            "id": "EXAM-0001-P3-O4",
            "text": "Approximately 250 mmHg",
            "textKpa": "Approximately 33.3 kPa"
          }
        ]
      },
      {
        "id": "EXAM-0001-P4",
        "kind": "single",
        "prompt": "Which of the following statements is true regarding management of this patient?",
        "marks": 1,
        "instruction": "Select one",
        "options": [
          {
            "id": "EXAM-0001-P4-O1",
            "text": "A history of G6PD deficiency is relevant because methylene blue may be less effective."
          },
          {
            "id": "EXAM-0001-P4-O2",
            "text": "This patient requires urgent intubation because the blood gas demonstrates ventilatory failure"
          },
          {
            "id": "EXAM-0001-P4-O3",
            "text": "Supplemental oxygen should be withheld because it cannot reverse methaemoglobin formation"
          },
          {
            "id": "EXAM-0001-P4-O4",
            "text": "Methylene blue should be repeated until the pulse oximeter reading exceeds 94%"
          }
        ]
      }
    ]
  },
  {
    "id": "EXAM-0002",
    "scenario": "An 83-year-old male has been transferred to your ED with an altered conscious state. An ABG is taken.",
    "tables": [
      {
        "id": "EXAM-0002-gas",
        "heading": "ABG Values",
        "grouping": "Patient 1 · presentation · arterial blood",
        "rows": [
          {
            "id": "EXAM-0002-ph",
            "label": "pH",
            "value": 7.09,
            "unit": "",
            "primary": true,
            "oxygenation": false,
            "pressure": false,
            "refLow": 7.35,
            "refHigh": 7.45
          },
          {
            "id": "EXAM-0002-pco2",
            "label": "PaCO2",
            "value": 72,
            "unit": "mmHg",
            "primary": true,
            "oxygenation": false,
            "pressure": true,
            "refLow": 35,
            "refHigh": 45
          },
          {
            "id": "EXAM-0002-hco3",
            "label": "HCO3",
            "value": 27,
            "unit": "mmol/L",
            "primary": true,
            "oxygenation": false,
            "pressure": false,
            "refLow": 22,
            "refHigh": 26
          },
          {
            "id": "EXAM-0002-fio2",
            "label": "FiO2",
            "value": 0.21,
            "unit": "",
            "primary": false,
            "oxygenation": true,
            "pressure": false
          },
          {
            "id": "EXAM-0002-po2",
            "label": "PaO2",
            "value": 50,
            "unit": "mmHg",
            "primary": false,
            "oxygenation": true,
            "pressure": true,
            "refLow": 80,
            "refHigh": 100
          },
          {
            "id": "EXAM-0002-na",
            "label": "Na",
            "value": 137,
            "unit": "mmol/L",
            "primary": false,
            "oxygenation": false,
            "pressure": false,
            "refLow": 135,
            "refHigh": 145
          },
          {
            "id": "EXAM-0002-k",
            "label": "K",
            "value": 4.2,
            "unit": "mmol/L",
            "primary": false,
            "oxygenation": false,
            "pressure": false,
            "refLow": 3.5,
            "refHigh": 5.0
          },
          {
            "id": "EXAM-0002-cl",
            "label": "Cl",
            "value": 104,
            "unit": "mmol/L",
            "primary": false,
            "oxygenation": false,
            "pressure": false,
            "refLow": 98,
            "refHigh": 106
          },
          {
            "id": "EXAM-0002-glucose",
            "label": "Glucose",
            "value": 6.2,
            "unit": "mmol/L",
            "primary": false,
            "oxygenation": false,
            "pressure": false,
            "refLow": 3.9,
            "refHigh": 7.8
          },
          {
            "id": "EXAM-0002-lactate",
            "label": "Lactate",
            "value": 1.3,
            "unit": "mmol/L",
            "primary": false,
            "oxygenation": false,
            "pressure": false,
            "refLow": 0.5,
            "refHigh": 2.0
          }
        ]
      }
    ],
    "parts": [
      {
        "id": "EXAM-0002-P1",
        "kind": "concept",
        "prompt": "Name the respiratory acid–base disturbance.",
        "marks": 1
      },
      {
        "id": "EXAM-0002-P2",
        "kind": "single",
        "prompt": "What is his approximate O2 saturation?",
        "marks": 1,
        "instruction": "Select one",
        "options": [
          {
            "id": "EXAM-0002-P2-O1",
            "text": "Approximately 90%"
          },
          {
            "id": "EXAM-0002-P2-O2",
            "text": "Approximately 80%"
          },
          {
            "id": "EXAM-0002-P2-O3",
            "text": "Approximately 70%"
          },
          {
            "id": "EXAM-0002-P2-O4",
            "text": "Approximately 60%"
          }
        ]
      },
      {
        "id": "EXAM-0002-P3",
        "kind": "multiAll",
        "prompt": "Which of the following would typically produce the acid–base pattern shown?",
        "marks": 1,
        "instruction": "Select all that apply",
        "options": [
          {
            "id": "EXAM-0002-P3-O1",
            "text": "Sedative intoxication (e.g. benzodiazepines)"
          },
          {
            "id": "EXAM-0002-P3-O2",
            "text": "Brainstem stroke"
          },
          {
            "id": "EXAM-0002-P3-O3",
            "text": "High cervical spinal cord injury"
          },
          {
            "id": "EXAM-0002-P3-O4",
            "text": "Acute pulmonary embolism"
          },
          {
            "id": "EXAM-0002-P3-O5",
            "text": "Salicylate toxicity"
          },
          {
            "id": "EXAM-0002-P3-O6",
            "text": "Stable severe COPD with chronic CO₂ retention"
          }
        ]
      },
      {
        "id": "EXAM-0002-P4",
        "kind": "concept",
        "prompt": "Why might CO2 rise when providing excessive supplemental oxygen to a patient with chronic CO2 retention?",
        "marks": 2
      }
    ]
  },
  {
    "id": "EXAM-0003",
    "scenario": "An 18-year-old female is brought into your ED with a GCS of 3. She is maintaining her own airway and is haemodynamically stable. She was found unconscious outside by a bystander.",
    "tables": [
      {
        "id": "EXAM-0003-gas",
        "heading": "Initial VBG",
        "grouping": "Patient 1 · presentation · venous blood",
        "rows": [
          {
            "id": "EXAM-0003-ph",
            "label": "pH",
            "value": 7.22,
            "unit": "",
            "primary": true,
            "oxygenation": false,
            "pressure": false,
            "refLow": 7.35,
            "refHigh": 7.45
          },
          {
            "id": "EXAM-0003-pco2",
            "label": "PCO2",
            "value": 61,
            "unit": "mmHg",
            "primary": true,
            "oxygenation": false,
            "pressure": true,
            "refLow": 35,
            "refHigh": 45
          },
          {
            "id": "EXAM-0003-hco3",
            "label": "HCO3",
            "value": 20,
            "unit": "mmol/L",
            "primary": true,
            "oxygenation": false,
            "pressure": false,
            "refLow": 22,
            "refHigh": 26
          },
          {
            "id": "EXAM-0003-na",
            "label": "Na",
            "value": 145,
            "unit": "mmol/L",
            "primary": false,
            "oxygenation": false,
            "pressure": false,
            "refLow": 135,
            "refHigh": 145
          },
          {
            "id": "EXAM-0003-k",
            "label": "K",
            "value": 4.5,
            "unit": "mmol/L",
            "primary": false,
            "oxygenation": false,
            "pressure": false,
            "refLow": 3.5,
            "refHigh": 5.0
          },
          {
            "id": "EXAM-0003-cl",
            "label": "Cl",
            "value": 111,
            "unit": "mmol/L",
            "primary": false,
            "oxygenation": false,
            "pressure": false,
            "refLow": 98,
            "refHigh": 106
          },
          {
            "id": "EXAM-0003-glucose",
            "label": "Glucose",
            "value": 4.6,
            "unit": "mmol/L",
            "primary": false,
            "oxygenation": false,
            "pressure": false,
            "refLow": 3.9,
            "refHigh": 7.8
          },
          {
            "id": "EXAM-0003-lactate",
            "label": "Lactate",
            "value": 1.2,
            "unit": "mmol/L",
            "primary": false,
            "oxygenation": false,
            "pressure": false,
            "refLow": 0.5,
            "refHigh": 2.0
          }
        ]
      }
    ],
    "parts": [
      {
        "id": "EXAM-0003-P1",
        "kind": "concept",
        "prompt": "What is your interpretation of this patient's acid-base status?",
        "marks": 2
      },
      {
        "id": "EXAM-0003-P2",
        "kind": "numeric",
        "prompt": "What is the expected PCO2?",
        "marks": 1,
        "pressureAnswer": true
      },
      {
        "id": "EXAM-0003-P3",
        "kind": "single",
        "prompt": "Which of the following mechanisms best explains the raised PCO2 in this patient?",
        "marks": 1,
        "instruction": "Select one",
        "options": [
          {
            "id": "EXAM-0003-P3-O1",
            "text": "Reduced alveolar ventilation due to central nervous system depression."
          },
          {
            "id": "EXAM-0003-P3-O2",
            "text": "Increased alveolar ventilation in response to metabolic acidosis."
          },
          {
            "id": "EXAM-0003-P3-O3",
            "text": "Impaired oxygen diffusion across the alveolar–capillary membrane."
          },
          {
            "id": "EXAM-0003-P3-O4",
            "text": "Renal bicarbonate loss causing compensatory hypoventilation."
          }
        ]
      }
    ]
  }
];
