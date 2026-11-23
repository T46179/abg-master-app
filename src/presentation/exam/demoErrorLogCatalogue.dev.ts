import type { ErrorLogCatalogue } from "./errorLogTypes";

// GENERATED DEV-only revision catalogue. Labels resolve separately from frozen feedback IDs.
// Refresh alongside feedback: py -B -m generator.exam_preview
export const demoErrorLogCatalogue: ErrorLogCatalogue = {
  "topics": [
    {
      "id": "acid_base",
      "label": "Acid–base"
    },
    {
      "id": "respiratory_ventilation",
      "label": "Respiratory & ventilation"
    },
    {
      "id": "oxygenation",
      "label": "Oxygenation & gas exchange"
    },
    {
      "id": "metabolic_endocrine",
      "label": "Metabolic & endocrine"
    },
    {
      "id": "renal_electrolytes",
      "label": "Renal & electrolytes"
    },
    {
      "id": "critical_care_resuscitation",
      "label": "Critical care & resuscitation"
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
      "id": "metabolic_alkalosis_recognition",
      "label": "Metabolic alkalosis: recognition and mechanism",
      "topicId": "acid_base",
      "errorType": "Interpretation and mechanism",
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
      "topicId": "acid_base",
      "errorType": "Calculation and interpretation",
      "active": true,
      "drillTarget": {
        "drill": "compensation",
        "rule": "met-acidosis"
      }
    },
    {
      "id": "respiratory_compensation_metabolic_alkalosis",
      "label": "Respiratory compensation in metabolic alkalosis",
      "topicId": "acid_base",
      "errorType": "Knowledge and interpretation",
      "active": true,
      "drillTarget": {
        "drill": "compensation",
        "rule": "met-alkalosis"
      }
    },
    {
      "id": "renal_compensation_respiratory_acidosis",
      "label": "Renal compensation in respiratory acidosis",
      "topicId": "acid_base",
      "errorType": "Knowledge and mechanism",
      "active": true
    },
    {
      "id": "anion_gap_calculation_interpretation",
      "label": "Anion gap calculation and interpretation",
      "topicId": "acid_base",
      "errorType": "Calculation and interpretation",
      "active": true,
      "drillTarget": {
        "drill": "anion-gap"
      }
    },
    {
      "id": "delta_ratio_calculation_interpretation",
      "label": "Delta ratio calculation and interpretation",
      "topicId": "acid_base",
      "errorType": "Calculation and interpretation",
      "active": true,
      "drillTarget": {
        "drill": "delta-ratio"
      }
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
      "topicId": "respiratory_ventilation",
      "errorType": "Knowledge and mechanism",
      "active": true
    },
    {
      "id": "copd_airflow_dead_space_co2_clearance",
      "label": "Airflow limitation, dead space and CO₂ clearance in COPD",
      "topicId": "respiratory_ventilation",
      "errorType": "Knowledge and mechanism",
      "active": true
    },
    {
      "id": "copd_ventilatory_pump_limitation",
      "label": "Respiratory muscle load and hypoventilation in COPD",
      "topicId": "respiratory_ventilation",
      "errorType": "Knowledge and mechanism",
      "active": true
    },
    {
      "id": "emergency_intubation_hypercapnic_respiratory_failure",
      "label": "Emergency intubation in acute hypercapnic respiratory failure",
      "topicId": "respiratory_ventilation",
      "errorType": "Clinical application",
      "active": true
    },
    {
      "id": "low_exhaled_tidal_volume_after_intubation_causes",
      "label": "Causes of low exhaled tidal volume after intubation",
      "topicId": "respiratory_ventilation",
      "errorType": "Knowledge and mechanism",
      "active": true
    },
    {
      "id": "inadequate_ventilation_after_intubation_troubleshooting",
      "label": "Troubleshooting inadequate ventilation after intubation",
      "topicId": "respiratory_ventilation",
      "errorType": "Clinical application",
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
      "active": true,
      "drillTarget": {
        "drill": "aa-gradient"
      }
    },
    {
      "id": "hypoxaemia_recognition",
      "label": "Hypoxaemia recognition",
      "topicId": "oxygenation",
      "errorType": "Interpretation",
      "active": true
    },
    {
      "id": "vq_mismatch_mechanisms",
      "label": "Ventilation–perfusion mismatch",
      "topicId": "oxygenation",
      "errorType": "Knowledge and mechanism",
      "active": true
    },
    {
      "id": "oxygen_induced_hypercapnia_mechanisms",
      "label": "Mechanisms of oxygen-induced hypercapnia",
      "topicId": "oxygenation",
      "errorType": "Mechanism",
      "active": true
    },
    {
      "id": "methaemoglobinaemia_oxygen_measurements",
      "label": "Oxygen measurements in methaemoglobinaemia",
      "topicId": "oxygenation",
      "errorType": "Knowledge and interpretation",
      "active": true
    },
    {
      "id": "methaemoglobinaemia_management",
      "label": "Management of methaemoglobinaemia",
      "topicId": "oxygenation",
      "errorType": "Clinical application",
      "active": true
    },
    {
      "id": "hagma_causes",
      "label": "Causes of high anion gap metabolic acidosis",
      "topicId": "acid_base",
      "errorType": "Knowledge and mechanism",
      "active": true
    },
    {
      "id": "hagma_respiratory_alkalosis_causes",
      "label": "Causes of combined HAGMA and respiratory alkalosis",
      "topicId": "acid_base",
      "errorType": "Knowledge and mechanism",
      "active": true
    },
    {
      "id": "lactate_trend_interpretation",
      "label": "Lactate trend interpretation",
      "topicId": "metabolic_endocrine",
      "errorType": "Interpretation",
      "active": true
    },
    {
      "id": "dynamic_hyperinflation",
      "label": "Dynamic hyperinflation",
      "topicId": "respiratory_ventilation",
      "errorType": "Knowledge and mechanism",
      "active": true
    },
    {
      "id": "serial_blood_gas_interpretation",
      "label": "Serial blood gas interpretation",
      "topicId": "acid_base",
      "errorType": "Interpretation",
      "active": true
    },
    {
      "id": "severe_asthma_mechanical_ventilation",
      "label": "Mechanical ventilation in severe asthma",
      "topicId": "respiratory_ventilation",
      "errorType": "Clinical application",
      "active": true
    },
    {
      "id": "oxygenation_trend_interpretation",
      "label": "Oxygenation trend interpretation",
      "topicId": "oxygenation",
      "errorType": "Interpretation",
      "active": true
    },
    {
      "id": "hyperkalaemia_trend_interpretation",
      "label": "Hyperkalaemia trend interpretation",
      "topicId": "renal_electrolytes",
      "errorType": "Interpretation",
      "active": true
    },
    {
      "id": "intracranial_pressure_management",
      "label": "Measures to reduce intracranial pressure",
      "topicId": "critical_care_resuscitation",
      "errorType": "Clinical application",
      "active": true
    },
    {
      "id": "hyperkalaemia_recognition",
      "label": "Hyperkalaemia recognition",
      "topicId": "renal_electrolytes",
      "errorType": "Interpretation",
      "active": true
    },
    {
      "id": "hyperkalaemia_complications",
      "label": "Hyperkalaemia and its complications",
      "topicId": "renal_electrolytes",
      "errorType": "Interpretation and clinical application",
      "active": true
    },
    {
      "id": "hyponatraemia_complications",
      "label": "Hyponatraemia and its complications",
      "topicId": "renal_electrolytes",
      "errorType": "Interpretation and clinical application",
      "active": true
    },
    {
      "id": "hyperglycaemia_recognition",
      "label": "Hyperglycaemia recognition",
      "topicId": "metabolic_endocrine",
      "errorType": "Interpretation",
      "active": true
    },
    {
      "id": "hyperglycaemia_corrected_sodium",
      "label": "Sodium interpretation in hyperglycaemia",
      "topicId": "renal_electrolytes",
      "errorType": "Interpretation",
      "active": true,
      "drillTarget": {
        "drill": "corrections"
      }
    },
    {
      "id": "renal_impairment_recognition",
      "label": "Renal impairment recognition",
      "topicId": "renal_electrolytes",
      "errorType": "Interpretation",
      "active": true
    },
    {
      "id": "serum_osmolality_calculation_interpretation",
      "label": "Serum osmolality calculation and interpretation",
      "topicId": "renal_electrolytes",
      "errorType": "Calculation and interpretation",
      "active": true
    },
    {
      "id": "hyperlactataemia_recognition",
      "label": "Hyperlactataemia recognition",
      "topicId": "metabolic_endocrine",
      "errorType": "Interpretation",
      "active": true
    },
    {
      "id": "bicarbonate_compensation_respiratory_alkalosis",
      "label": "Bicarbonate compensation in respiratory alkalosis",
      "topicId": "acid_base",
      "errorType": "Calculation and interpretation",
      "active": true,
      "drillTarget": {
        "drill": "compensation",
        "rule": "respiratory"
      }
    },
    {
      "id": "bicarbonate_compensation_respiratory_acidosis",
      "label": "Bicarbonate compensation in respiratory acidosis",
      "topicId": "acid_base",
      "errorType": "Calculation",
      "active": true,
      "drillTarget": {
        "drill": "compensation",
        "rule": "respiratory"
      }
    },
    {
      "id": "delta_gap_calculation_interpretation",
      "label": "Delta gap and adjusted bicarbonate",
      "topicId": "acid_base",
      "errorType": "Calculation and interpretation",
      "active": true
    },
    {
      "id": "starvation_acidosis_mechanisms",
      "label": "Mechanisms of acidosis in starvation",
      "topicId": "metabolic_endocrine",
      "errorType": "Knowledge and mechanism",
      "active": true
    },
    {
      "id": "refeeding_potassium_depletion_shifts",
      "label": "Potassium depletion and shifts during refeeding",
      "topicId": "metabolic_endocrine",
      "errorType": "Knowledge and mechanism",
      "active": true
    },
    {
      "id": "refeeding_syndrome_complications",
      "label": "Complications of refeeding syndrome",
      "topicId": "metabolic_endocrine",
      "errorType": "Knowledge",
      "active": true
    }
  ]
};
