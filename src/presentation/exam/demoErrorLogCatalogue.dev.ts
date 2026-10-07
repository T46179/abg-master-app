import type { ErrorLogCatalogue } from "./errorLogTypes";

// GENERATED DEV-only revision catalogue. Labels resolve separately from frozen feedback IDs.
// Refresh alongside feedback: py -B -m generator.exam_preview
export const demoErrorLogCatalogue: ErrorLogCatalogue = {
  "topics": [
    {
      "id": "acid_base",
      "label": "Acid–base interpretation"
    },
    {
      "id": "compensation",
      "label": "Compensation"
    },
    {
      "id": "anion_gap",
      "label": "Anion gap"
    },
    {
      "id": "delta_ratio",
      "label": "Delta ratio"
    },
    {
      "id": "oxygenation",
      "label": "Oxygenation"
    },
    {
      "id": "mechanisms",
      "label": "Causes and mechanisms"
    },
    {
      "id": "methaemoglobinaemia",
      "label": "Methaemoglobinaemia"
    },
    {
      "id": "lactate",
      "label": "Lactate"
    },
    {
      "id": "severe_asthma",
      "label": "Severe asthma"
    },
    {
      "id": "serial_gases",
      "label": "Serial blood gases"
    }
  ],
  "concepts": [
    {
      "id": "respiratory_acidosis_recognition",
      "label": "Respiratory acidosis recognition",
      "topicId": "acid_base",
      "errorType": "Interpretation",
      "active": true
    },
    {
      "id": "respiratory_alkalosis_recognition",
      "label": "Respiratory alkalosis recognition",
      "topicId": "acid_base",
      "errorType": "Interpretation",
      "active": true
    },
    {
      "id": "metabolic_acidosis_recognition",
      "label": "Metabolic acidosis recognition",
      "topicId": "acid_base",
      "errorType": "Interpretation",
      "active": true
    },
    {
      "id": "hagma_recognition",
      "label": "High anion gap metabolic acidosis recognition",
      "topicId": "acid_base",
      "errorType": "Interpretation",
      "active": true
    },
    {
      "id": "respiratory_compensation_metabolic_acidosis",
      "label": "Respiratory compensation in metabolic acidosis",
      "topicId": "compensation",
      "errorType": "Calculation and interpretation",
      "active": true
    },
    {
      "id": "anion_gap_calculation_interpretation",
      "label": "Anion gap calculation and interpretation",
      "topicId": "anion_gap",
      "errorType": "Calculation and interpretation",
      "active": true
    },
    {
      "id": "delta_ratio_calculation_interpretation",
      "label": "Delta ratio calculation and interpretation",
      "topicId": "delta_ratio",
      "errorType": "Calculation and interpretation",
      "active": true
    },
    {
      "id": "mixed_acid_base_disorder_recognition",
      "label": "Mixed acid–base disorder recognition",
      "topicId": "acid_base",
      "errorType": "Interpretation",
      "active": true
    },
    {
      "id": "acute_respiratory_acidosis_causes",
      "label": "Causes of acute respiratory acidosis",
      "topicId": "mechanisms",
      "errorType": "Knowledge and mechanism",
      "active": true
    },
    {
      "id": "oxyhaemoglobin_dissociation_curve",
      "label": "Oxyhaemoglobin dissociation curve",
      "topicId": "oxygenation",
      "errorType": "Knowledge and interpretation",
      "active": true
    },
    {
      "id": "aa_gradient_calculation_interpretation",
      "label": "A–a gradient calculation and interpretation",
      "topicId": "oxygenation",
      "errorType": "Calculation and interpretation",
      "active": true
    },
    {
      "id": "oxygen_induced_hypercapnia_mechanisms",
      "label": "Mechanisms of oxygen-induced hypercapnia",
      "topicId": "mechanisms",
      "errorType": "Mechanism",
      "active": true
    },
    {
      "id": "methaemoglobinaemia_oxygen_measurements",
      "label": "Oxygen measurements in methaemoglobinaemia",
      "topicId": "methaemoglobinaemia",
      "errorType": "Knowledge and interpretation",
      "active": true
    },
    {
      "id": "methaemoglobinaemia_management",
      "label": "Management of methaemoglobinaemia",
      "topicId": "methaemoglobinaemia",
      "errorType": "Clinical application",
      "active": true
    },
    {
      "id": "hagma_respiratory_alkalosis_causes",
      "label": "Causes of HAGMA with respiratory alkalosis",
      "topicId": "mechanisms",
      "errorType": "Knowledge and mechanism",
      "active": true
    },
    {
      "id": "lactate_trend_interpretation",
      "label": "Lactate trend interpretation",
      "topicId": "lactate",
      "errorType": "Interpretation",
      "active": true
    },
    {
      "id": "dynamic_hyperinflation",
      "label": "Dynamic hyperinflation",
      "topicId": "severe_asthma",
      "errorType": "Knowledge and mechanism",
      "active": true
    },
    {
      "id": "serial_blood_gas_interpretation",
      "label": "Serial blood gas interpretation",
      "topicId": "serial_gases",
      "errorType": "Interpretation",
      "active": true
    },
    {
      "id": "severe_asthma_mechanical_ventilation",
      "label": "Mechanical ventilation in severe asthma",
      "topicId": "severe_asthma",
      "errorType": "Clinical application",
      "active": true
    }
  ]
};
