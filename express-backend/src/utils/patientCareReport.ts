type Section = {
  heading: string;
  body: string;
};

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function toText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function uniqueLines(lines: string[]) {
  return [...new Set(lines.map((line) => line.trim()).filter(Boolean))];
}

function titleCase(value: string) {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function flattenSentenceList(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.flatMap((item) => flattenSentenceList(item)).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(/\n|[|]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, item]) => {
      if (!item) return [];
      if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') {
        return [`${titleCase(key)}: ${String(item)}`];
      }
      const nested = flattenSentenceList(item);
      return nested.length > 0 ? [`${titleCase(key)}: ${nested.join('; ')}`] : [];
    });
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return [String(value)];
  }
  return [];
}

function flattenPlanItems(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (item && typeof item === 'object' && typeof (item as any).text === 'string') {
        return (item as any).text.trim();
      }
      return '';
    })
    .filter(Boolean);
}

function joinReasons(value: unknown): string {
  return flattenSentenceList(value).join(' ');
}

function percentLabel(value: number | null | undefined) {
  if (value === null || value === undefined) return null;
  return `${Math.round(value * 100)}%`;
}

function normalizeReportAgentOutputs(agentOutputs?: Record<string, unknown>) {
  const outputs = agentOutputs ?? {};
  return {
    risk:
      (outputs.risk as Record<string, unknown> | undefined) ??
      (outputs.get_risk_explain as Record<string, unknown> | undefined) ??
      (outputs.get_risk as Record<string, unknown> | undefined) ??
      null,
    lifestyle:
      (outputs.lifestyle as Record<string, unknown> | undefined) ??
      (outputs.get_lifestyle as Record<string, unknown> | undefined) ??
      null,
    medication:
      (outputs.medication as Record<string, unknown> | undefined) ??
      (outputs.get_medication as Record<string, unknown> | undefined) ??
      null,
    explainability:
      (outputs.explainability as Record<string, unknown> | undefined) ??
      (outputs.get_explainability as Record<string, unknown> | undefined) ??
      null,
  };
}

function getRiskData(
  normalized: ReturnType<typeof normalizeReportAgentOutputs>,
  latestRisk: any,
) {
  const raw = normalized.risk;
  if (raw) {
    const probability = asNumber((raw as any).risk_score) ?? asNumber((raw as any).probability);
    const label =
      toText((raw as any).risk_label) ||
      (((raw as any).predicted_label === 1 || (probability ?? 0) >= 0.5) ? 'Higher' : 'Lower');
    return {
      probability,
      label,
      explanation: ((raw as any).explanation ?? {}) as Record<string, unknown>,
    };
  }

  if (!latestRisk) return null;
  const probability = asNumber(latestRisk.probability);
  const label = latestRisk.predicted_label === 1 ? 'Higher' : 'Lower';
  return {
    probability,
    label,
    explanation: (latestRisk.explanation ?? {}) as Record<string, unknown>,
  };
}

function getLifestyleData(
  normalized: ReturnType<typeof normalizeReportAgentOutputs>,
  latestLifestyle: any,
) {
  const raw = ((normalized.lifestyle as any)?.data ?? normalized.lifestyle ?? {}) as Record<string, any>;
  return {
    plan: (raw.plan ?? latestLifestyle?.plan ?? {}) as Record<string, unknown>,
    guidelines: (raw.guidelines_used ?? latestLifestyle?.guidelines_used ?? []) as any[],
  };
}

function getMedicationData(
  normalized: ReturnType<typeof normalizeReportAgentOutputs>,
  latestMedication: any,
) {
  const raw = ((normalized.medication as any)?.data ?? normalized.medication ?? {}) as Record<string, any>;
  const primary =
    raw.primary_option ??
    latestMedication?.llm_raw_output?.primary_option ??
    null;
  const alternatives =
    raw.alternatives ??
    latestMedication?.llm_raw_output?.alternatives ??
    [];
  const recommended =
    raw.recommended_medications ??
    latestMedication?.consensus_output?.recommended_medications ??
    [];
  const warnings =
    raw.warnings ??
    latestMedication?.consensus_output?.warnings ??
    latestMedication?.safety_output?.warnings ??
    [];
  const missingInformation =
    raw.missing_information ??
    latestMedication?.llm_raw_output?.missing_information ??
    [];
  const clinicalReasoning =
    raw.clinical_reasoning ??
    latestMedication?.clinical_reasoning ??
    latestMedication?.consensus_output?.final_reasoning ??
    '';

  return {
    primary,
    alternatives,
    recommended,
    warnings: flattenSentenceList(warnings),
    missingInformation: flattenSentenceList(missingInformation),
    clinicalReasoning: toText(clinicalReasoning),
    safetyFlags: (raw.safety_flags ?? latestMedication?.safety_flags ?? {}) as Record<string, unknown>,
    evidenceSources: (latestMedication?.retrieved_sources ?? []) as any[],
  };
}

function buildClinicalSnapshot(patient: any) {
  const snapshot: string[] = [];
  if (patient?.age) snapshot.push(`Age: ${patient.age}`);
  if (patient?.sex) snapshot.push(`Sex: ${patient.sex}`);
  if (patient?.height_cm) snapshot.push(`Height: ${patient.height_cm} cm`);
  if (patient?.weight_kg) snapshot.push(`Weight: ${patient.weight_kg} kg`);
  if (patient?.lab_tests?.hba1c !== undefined) snapshot.push(`HbA1c: ${patient.lab_tests.hba1c}%`);
  if (patient?.lab_tests?.fasting_glucose !== undefined) {
    snapshot.push(`Fasting glucose: ${patient.lab_tests.fasting_glucose} mg/dL`);
  }
  if (patient?.lab_tests?.glucose !== undefined) {
    snapshot.push(`Random glucose: ${patient.lab_tests.glucose} mg/dL`);
  }
  if (patient?.lab_tests?.cholesterol !== undefined) {
    snapshot.push(`Total cholesterol: ${patient.lab_tests.cholesterol} mg/dL`);
  }
  if (patient?.lab_tests?.hdl !== undefined) snapshot.push(`HDL: ${patient.lab_tests.hdl} mg/dL`);
  if (patient?.lab_tests?.ldl !== undefined) snapshot.push(`LDL: ${patient.lab_tests.ldl} mg/dL`);
  if (patient?.lab_tests?.triglycerides !== undefined) {
    snapshot.push(`Triglycerides: ${patient.lab_tests.triglycerides} mg/dL`);
  }
  if (patient?.vital_signs?.bmi !== undefined) snapshot.push(`BMI: ${patient.vital_signs.bmi}`);
  if (
    patient?.vital_signs?.systolic_bp !== undefined &&
    patient?.vital_signs?.diastolic_bp !== undefined
  ) {
    snapshot.push(
      `Blood pressure: ${patient.vital_signs.systolic_bp}/${patient.vital_signs.diastolic_bp} mmHg`,
    );
  }
  if (Array.isArray(patient?.conditions) && patient.conditions.length > 0) {
    snapshot.push(`Conditions: ${patient.conditions.join(', ')}`);
  }
  if (patient?.lifestyle?.smoking) snapshot.push(`Smoking: ${patient.lifestyle.smoking}`);
  if (patient?.lifestyle?.drinking) snapshot.push(`Drinking: ${patient.lifestyle.drinking}`);
  if (patient?.lifestyle?.exercise) snapshot.push(`Exercise: ${patient.lifestyle.exercise}`);
  return snapshot;
}

function buildProtectiveFactors(patient: any, riskData: any) {
  const lines: string[] = [];
  const hba1c = asNumber(patient?.lab_tests?.hba1c);
  const fasting = asNumber(patient?.lab_tests?.fasting_glucose);
  const bmi = asNumber(patient?.vital_signs?.bmi);
  const systolic = asNumber(patient?.vital_signs?.systolic_bp);
  const diastolic = asNumber(patient?.vital_signs?.diastolic_bp);
  const exercise = toText(patient?.lifestyle?.exercise).toLowerCase();
  const smoking = toText(patient?.lifestyle?.smoking).toLowerCase();
  const drinking = toText(patient?.lifestyle?.drinking).toLowerCase();

  if (hba1c !== null && hba1c < 5.7) {
    lines.push(`HbA1c ${hba1c}% is currently in a reassuring range.`);
  }
  if (fasting !== null && fasting < 100) {
    lines.push(`Fasting glucose ${fasting} mg/dL does not currently suggest fasting dysglycemia.`);
  }
  if (bmi !== null && bmi >= 18.5 && bmi < 25) {
    lines.push(`BMI ${bmi} is within a healthy range for metabolic risk reduction.`);
  }
  if (systolic !== null && diastolic !== null && systolic < 130 && diastolic < 80) {
    lines.push(`Blood pressure ${systolic}/${diastolic} mmHg is within the preferred range.`);
  }
  if (exercise === 'moderate' || exercise === 'heavy') {
    lines.push(`Current ${exercise} exercise pattern is a strong protective lifestyle factor.`);
  }
  if (smoking === 'never' || smoking === 'former') {
    lines.push('No active smoking exposure is documented.');
  }
  if (drinking === 'never' || drinking === 'former') {
    lines.push('Alcohol intake is not adding a current metabolic burden in the profile.');
  }
  if (riskData?.label === 'Lower' && riskData?.probability !== null && riskData?.probability !== undefined) {
    lines.push(
      `Latest model output places the patient in the lower-risk group (${percentLabel(riskData.probability)}).`,
    );
  }

  return uniqueLines(lines);
}

function buildActiveConcerns(patient: any, riskData: any) {
  const lines: string[] = [];
  const hba1c = asNumber(patient?.lab_tests?.hba1c);
  const fasting = asNumber(patient?.lab_tests?.fasting_glucose);
  const randomGlucose = asNumber(patient?.lab_tests?.glucose);
  const bmi = asNumber(patient?.vital_signs?.bmi);
  const systolic = asNumber(patient?.vital_signs?.systolic_bp);
  const diastolic = asNumber(patient?.vital_signs?.diastolic_bp);
  const cholesterol = asNumber(patient?.lab_tests?.cholesterol);
  const ldl = asNumber(patient?.lab_tests?.ldl);
  const hdl = asNumber(patient?.lab_tests?.hdl);
  const triglycerides = asNumber(patient?.lab_tests?.triglycerides);
  const smoking = toText(patient?.lifestyle?.smoking).toLowerCase();
  const drinking = toText(patient?.lifestyle?.drinking).toLowerCase();
  const exercise = toText(patient?.lifestyle?.exercise).toLowerCase();

  if (!riskData) {
    lines.push('No current standalone risk prediction is saved, so this report relies primarily on the latest clinical profile.');
  } else if (riskData.label === 'Higher' || (riskData.probability ?? 0) >= 0.5) {
    lines.push(
      `The latest model output suggests higher diabetes risk${riskData.probability !== null && riskData.probability !== undefined ? ` (${percentLabel(riskData.probability)})` : ''}.`,
    );
  }

  if (hba1c !== null) {
    if (hba1c >= 6.5) lines.push(`HbA1c ${hba1c}% is in the diabetic range and warrants close follow-up.`);
    else if (hba1c >= 5.7) lines.push(`HbA1c ${hba1c}% is above the normal range and should be trended closely.`);
  }

  if (fasting !== null) {
    if (fasting >= 126) lines.push(`Fasting glucose ${fasting} mg/dL is markedly elevated.`);
    else if (fasting >= 100) lines.push(`Fasting glucose ${fasting} mg/dL is above the ideal range.`);
  }

  if (randomGlucose !== null && randomGlucose >= 140) {
    lines.push(`Random glucose ${randomGlucose} mg/dL is higher than ideal and should be interpreted with trend data or meal timing.`);
  } else if (randomGlucose !== null && randomGlucose >= 130) {
    lines.push(`Random glucose ${randomGlucose} mg/dL is mildly elevated and worth monitoring over time.`);
  }

  if (bmi !== null) {
    if (bmi >= 30) lines.push(`BMI ${bmi} is in the obesity range and increases long-term cardiometabolic risk.`);
    else if (bmi >= 25) lines.push(`BMI ${bmi} is above the healthy range and should inform weight-focused counseling.`);
    else if (bmi < 18.5) lines.push(`BMI ${bmi} is below the healthy range and may affect nutrition planning.`);
  }

  if (systolic !== null && diastolic !== null) {
    if (systolic >= 130 || diastolic >= 80) {
      lines.push(`Blood pressure ${systolic}/${diastolic} mmHg is above the preferred range and should be rechecked.`);
    }
  }

  if (cholesterol !== null && cholesterol >= 200) {
    lines.push(`Total cholesterol ${cholesterol} mg/dL is above the desirable range.`);
  }
  if (ldl !== null && ldl >= 100) {
    lines.push(`LDL ${ldl} mg/dL is above the optimal target for long-term cardiovascular prevention.`);
  }
  if (hdl !== null) {
    const lowHdlThreshold = toText(patient?.sex).toLowerCase() === 'female' ? 50 : 40;
    if (hdl < lowHdlThreshold) {
      lines.push(`HDL ${hdl} mg/dL is lower than ideal.`);
    }
  }
  if (triglycerides !== null && triglycerides >= 150) {
    lines.push(`Triglycerides ${triglycerides} mg/dL are elevated.`);
  }

  if (smoking === 'regularly' || smoking === 'occasionally') {
    lines.push(`Current smoking status (${patient?.lifestyle?.smoking}) is a modifiable cardiovascular risk factor.`);
  }
  if (drinking === 'regularly') {
    lines.push('Regular alcohol intake should be reviewed as part of long-term metabolic risk reduction.');
  }
  if (exercise === 'none' || exercise === 'light') {
    lines.push(`Current exercise level (${patient?.lifestyle?.exercise || 'not documented'}) leaves room for activity-based risk reduction.`);
  }
  if (Array.isArray(patient?.conditions) && patient.conditions.length > 0) {
    lines.push(`Existing conditions requiring consideration: ${patient.conditions.join(', ')}.`);
  }

  return uniqueLines(lines);
}

function buildRiskDrivers(riskData: any, activeConcerns: string[], protectiveFactors: string[]) {
  const topFeatures = Array.isArray(riskData?.explanation?.top_features)
    ? riskData.explanation.top_features
    : Array.isArray(riskData?.explanation?.top_contributors)
      ? riskData.explanation.top_contributors
      : [];

  const modelDrivers = topFeatures.slice(0, 6).map((feature: any) => {
    const name = String(feature?.name ?? feature?.feature ?? 'Clinical factor').replace(/_/g, ' ');
    const direction = toText(feature?.direction);
    const importance =
      typeof feature?.importance === 'number'
        ? `${feature.importance > 0 ? '+' : ''}${feature.importance.toFixed(2)}`
        : '';
    const details = [direction ? `direction ${direction}` : '', importance ? `impact ${importance}` : '']
      .filter(Boolean)
      .join(', ');
    return details ? `${name} (${details})` : name;
  });

  if (modelDrivers.length > 0) return uniqueLines(modelDrivers);

  return uniqueLines([
    ...activeConcerns.slice(0, 3),
    ...protectiveFactors.slice(0, 2),
  ]).slice(0, 5);
}

function buildOverview(
  patient: any,
  riskData: any,
  activeConcerns: string[],
  protectiveFactors: string[],
) {
  const name = toText(patient?.full_name) || 'This patient';
  const age = patient?.age ? `${patient.age}-year-old` : 'adult';
  const sex = toText(patient?.sex).toLowerCase() || 'patient';
  const hba1c = asNumber(patient?.lab_tests?.hba1c);
  const fasting = asNumber(patient?.lab_tests?.fasting_glucose);
  const bmi = asNumber(patient?.vital_signs?.bmi);

  const status = riskData
    ? `${riskData.label.toLowerCase()} model-predicted diabetes risk${riskData.probability !== null && riskData.probability !== undefined ? ` (${percentLabel(riskData.probability)})` : ''}`
    : 'no saved standalone diabetes risk score';

  const metrics = [
    hba1c !== null ? `HbA1c ${hba1c}%` : '',
    fasting !== null ? `fasting glucose ${fasting} mg/dL` : '',
    bmi !== null ? `BMI ${bmi}` : '',
  ].filter(Boolean).join(', ');

  const strengths = protectiveFactors[0] ? `Key protective factors include ${protectiveFactors.slice(0, 2).join(' and ').replace(/\.$/, '')}.` : '';
  const concerns = activeConcerns[0] ? `Main issues to address now: ${activeConcerns.slice(0, 2).join(' ')}` : '';

  return [
    `${name} is a ${age} ${sex} with ${status}.`,
    metrics ? `Current profile: ${metrics}.` : '',
    strengths,
    concerns,
  ].filter(Boolean).join(' ');
}

function buildRiskSummary(patient: any, riskData: any, activeConcerns: string[], protectiveFactors: string[]) {
  if (riskData) {
    const percent = percentLabel(riskData.probability);
    return percent
      ? `${riskData.label} diabetes risk (${percent}) based on the latest available model-supported assessment.`
      : `${riskData.label} diabetes risk based on the latest available model-supported assessment.`;
  }

  const hba1c = asNumber(patient?.lab_tests?.hba1c);
  const fasting = asNumber(patient?.lab_tests?.fasting_glucose);
  if ((hba1c !== null && hba1c < 5.7) && (fasting !== null && fasting < 100)) {
    return 'No saved model risk score is available, but the current glycemic profile is reassuring.';
  }
  return `No saved model risk score is available. Current clinical concerns: ${activeConcerns.slice(0, 2).join(' ') || protectiveFactors[0] || 'see detailed sections below.'}`;
}

function buildRiskNarrative(riskData: any, activeConcerns: string[], protectiveFactors: string[]) {
  const riskExplanation = toText(riskData?.explanation?.risk_explanation);
  if (riskExplanation) {
    return riskExplanation;
  }

  return uniqueLines([
    activeConcerns[0] ?? '',
    activeConcerns[1] ?? '',
    protectiveFactors[0] ?? '',
    protectiveFactors[1] ?? '',
  ]).join(' ');
}

function buildLifestyleSuggestions(patient: any, lifestyleData: any, activeConcerns: string[]) {
  const diet = flattenPlanItems(lifestyleData.plan?.diet);
  const activity = flattenPlanItems(lifestyleData.plan?.activity);
  const sleep = flattenPlanItems(lifestyleData.plan?.sleep);
  const other = flattenPlanItems(lifestyleData.plan?.other);

  const exercise = toText(patient?.lifestyle?.exercise).toLowerCase();
  const hba1c = asNumber(patient?.lab_tests?.hba1c);
  const fasting = asNumber(patient?.lab_tests?.fasting_glucose);
  const systolic = asNumber(patient?.vital_signs?.systolic_bp);
  const diastolic = asNumber(patient?.vital_signs?.diastolic_bp);
  const smoking = toText(patient?.lifestyle?.smoking).toLowerCase();

  const lines: string[] = [];

  if (hba1c !== null && fasting !== null && hba1c < 5.7 && fasting < 100) {
    lines.push(
      `Maintain the current glucose-friendly eating pattern to preserve HbA1c ${hba1c}% and fasting glucose ${fasting} mg/dL. ${diet[0] ?? 'Keep meals built around vegetables, whole foods, and fiber-rich carbohydrates.'}`,
    );
  } else {
    lines.push(
      `Use meal consistency, fiber, and carbohydrate quality to improve glycemic trends. ${diet[0] ?? 'Prioritize vegetables, lean protein, and minimally processed carbohydrates.'}`,
    );
  }

  if (exercise === 'heavy' || exercise === 'moderate') {
    const nonBeginnerActivity = activity.find((line) => !/new to exercise|start with short/i.test(line)) ?? activity[0];
    lines.push(
      `Preserve the current ${exercise} exercise routine while building in recovery, hydration, and blood-pressure awareness. ${nonBeginnerActivity ?? 'Aim to keep structured aerobic and resistance activity in the weekly routine.'}`,
    );
  } else {
    lines.push(
      `Increase structured activity gradually from the current ${patient?.lifestyle?.exercise || 'undocumented'} baseline. ${activity[0] ?? 'Work toward regular aerobic activity across most days of the week.'}`,
    );
  }

  if (systolic !== null && diastolic !== null && (systolic >= 130 || diastolic >= 80)) {
    const bloodPressureLine = other.find((line) => /blood pressure|salt|sodium/i.test(line)) ?? '';
    lines.push(
      `Because blood pressure is ${systolic}/${diastolic} mmHg, emphasize sodium awareness, regular aerobic activity, and repeat BP checks. ${bloodPressureLine}`,
    );
  }

  lines.push(
    `${sleep[0] ?? 'Protect sleep quality with a consistent 7-9 hour sleep schedule.'}`,
  );

  if (smoking === 'regularly' || smoking === 'occasionally') {
    const smokingLine = other.find((line) => /smok/i.test(line)) ?? 'Treat smoking cessation as a core prevention target.';
    lines.push(smokingLine);
  } else if (other[0]) {
    lines.push(other[0]);
  }

  if (activeConcerns.some((line) => /random glucose/i.test(line)) && diet[1]) {
    lines.push(`Track meal patterns around higher glucose readings and reinforce carbohydrate quality. ${diet[1]}`);
  }

  return uniqueLines(lines).slice(0, 8);
}

function buildMedicationSuggestions(patient: any, medicationData: any) {
  const hba1c = asNumber(patient?.lab_tests?.hba1c);
  const fasting = asNumber(patient?.lab_tests?.fasting_glucose);
  const primaryName = toText(medicationData.primary?.drug_name);
  const primaryReason = joinReasons(medicationData.primary?.why);
  const recommended = Array.isArray(medicationData.recommended) ? medicationData.recommended : [];
  const alternativeNames = medicationData.alternatives
    .map((item: any) => toText(item?.drug_name))
    .filter(Boolean);

  const lines: string[] = [];

  if (!primaryName || /lifestyle intervention/i.test(primaryName)) {
    lines.push(
      `No glucose-lowering medication is clearly indicated from the current profile${hba1c !== null || fasting !== null ? ` (HbA1c ${hba1c ?? 'n/a'}%, fasting glucose ${fasting ?? 'n/a'} mg/dL)` : ''}. Prevention-focused care remains the priority.`,
    );
  } else {
    lines.push(`Primary option for clinician review: ${primaryName}. ${primaryReason || medicationData.clinicalReasoning}`);
  }

  const cgmRecommendation = recommended.find((item: any) => /cgm|continuous glucose monitoring/i.test(toText(item?.name)));
  if (cgmRecommendation) {
    lines.push(
      `Continuous glucose monitoring can be considered for trend tracking if the clinician wants more detailed glucose pattern data. ${toText(cgmRecommendation.reason)}`,
    );
  }

  if (alternativeNames.length > 0 && !/lifestyle intervention/i.test(primaryName)) {
    lines.push(`Alternatives noted for review: ${alternativeNames.slice(0, 3).join(', ')}.`);
  }

  if (medicationData.clinicalReasoning) {
    lines.push(medicationData.clinicalReasoning);
  }

  if (medicationData.warnings.length > 0) {
    lines.push(`Safety and validation notes: ${medicationData.warnings.slice(0, 3).join(' ')}`);
  }

  if (medicationData.missingInformation.length > 0) {
    lines.push(`Before medication changes, confirm: ${medicationData.missingInformation.slice(0, 3).join(', ')}.`);
  }

  return uniqueLines(lines).slice(0, 8);
}

function buildMonitoringPlan(patient: any, riskData: any, medicationData: any, activeConcerns: string[]) {
  const lines: string[] = [];
  const hba1c = asNumber(patient?.lab_tests?.hba1c);
  const fasting = asNumber(patient?.lab_tests?.fasting_glucose);
  const systolic = asNumber(patient?.vital_signs?.systolic_bp);
  const diastolic = asNumber(patient?.vital_signs?.diastolic_bp);

  if (hba1c !== null) {
    if (hba1c >= 5.7) {
      lines.push(`Trend HbA1c more closely because the current value is ${hba1c}%.`);
    } else {
      lines.push(`Repeat HbA1c at the usual clinician-directed interval to confirm stability from the current ${hba1c}% baseline.`);
    }
  }

  if (fasting !== null) {
    lines.push(`Monitor fasting or home glucose trends against the current ${fasting} mg/dL baseline.`);
  }

  if (systolic !== null && diastolic !== null && (systolic >= 130 || diastolic >= 80)) {
    lines.push(`Repeat blood pressure readings and compare against the current ${systolic}/${diastolic} mmHg baseline.`);
  }

  if (!riskData) {
    lines.push('Generate or refresh a model-based risk assessment when the next clinical review is completed.');
  }

  if (medicationData.missingInformation.some((item: string) => /renal|kidney/i.test(item)) || patient?.lab_tests?.creatinine === undefined) {
    lines.push('Document renal function before considering future pharmacologic escalation.');
  }

  if (activeConcerns.some((line) => /lipid|cholesterol|ldl|hdl|triglycerides/i.test(line)) || patient?.lab_tests?.triglycerides === undefined) {
    lines.push('Review the lipid profile at follow-up so cardiovascular prevention advice stays targeted.');
  }

  return uniqueLines(lines).slice(0, 8);
}

function buildDoctorConsiderations(patient: any, riskData: any, medicationData: any) {
  const lines: string[] = [];

  if (!riskData) {
    lines.push('No saved standalone risk prediction was available when this report was generated.');
  }

  if (patient?.lab_tests?.creatinine === undefined) {
    lines.push('Creatinine is not documented in the current profile, which limits medication escalation planning.');
  }

  if (patient?.lab_tests?.triglycerides === undefined) {
    lines.push('Triglycerides are not documented in the current profile.');
  }

  if (medicationData.missingInformation.length > 0) {
    lines.push(`Medication pipeline requested additional inputs: ${medicationData.missingInformation.slice(0, 4).join(', ')}.`);
  }

  if (medicationData.warnings.length > 0) {
    lines.push(`Medication safety notes requiring clinician attention: ${medicationData.warnings.slice(0, 3).join(' ')}`);
  }

  if (!Array.isArray(patient?.conditions) || patient.conditions.length === 0) {
    lines.push('No chronic conditions are documented in the current patient profile, so recommendations are driven mainly by vitals, labs, and lifestyle history.');
  }

  return uniqueLines(lines).slice(0, 8);
}

function buildEvidenceSummary(lifestyleData: any, medicationData: any, explainability: any) {
  const lines: string[] = [];

  const evidenceSummary = Array.isArray(explainability?.evidence_summary)
    ? explainability.evidence_summary
    : [];
  for (const item of evidenceSummary.slice(0, 4)) {
    const title = toText(item?.title);
    const detail = toText(item?.detail);
    if (title || detail) {
      lines.push([title, detail].filter(Boolean).join(': '));
    }
  }

  for (const item of (lifestyleData.guidelines ?? []).slice(0, 3)) {
    const source = toText(item?.source);
    const reference = toText(item?.reference);
    const text = toText(item?.text);
    lines.push([source || 'Lifestyle evidence', text, reference].filter(Boolean).join(' - '));
  }

  for (const item of (medicationData.evidenceSources ?? []).slice(0, 3)) {
    const title = toText(item?.title);
    const url = toText(item?.url);
    const snippet = toText(item?.snippet);
    lines.push([title || 'Medication evidence', snippet, url].filter(Boolean).join(' - '));
  }

  return uniqueLines(lines).slice(0, 8);
}

function buildNextSteps(
  activeConcerns: string[],
  lifestyleSuggestions: string[],
  medicationSuggestions: string[],
  monitoringPlan: string[],
) {
  return uniqueLines([
    activeConcerns[0] ?? '',
    lifestyleSuggestions[0] ?? '',
    medicationSuggestions[0] ?? '',
    monitoringPlan[0] ?? '',
    monitoringPlan[1] ?? '',
  ]).slice(0, 6);
}

export function buildPatientCareReportContent(args: {
  patient: any;
  latestRisk?: any;
  latestLifestyle?: any;
  latestMedication?: any;
  agentOutputs?: Record<string, unknown>;
  conversationId: string;
}) {
  const normalized = normalizeReportAgentOutputs(args.agentOutputs);
  const riskData = getRiskData(normalized, args.latestRisk);
  const lifestyleData = getLifestyleData(normalized, args.latestLifestyle);
  const medicationData = getMedicationData(normalized, args.latestMedication);
  const explainability = normalized.explainability ?? riskData?.explanation ?? null;

  const clinicalSnapshot = buildClinicalSnapshot(args.patient);
  const protectiveFactors = buildProtectiveFactors(args.patient, riskData);
  const activeConcerns = buildActiveConcerns(args.patient, riskData);
  const riskDrivers = buildRiskDrivers(riskData, activeConcerns, protectiveFactors);
  const lifestyleSuggestions = buildLifestyleSuggestions(args.patient, lifestyleData, activeConcerns);
  const medicationSuggestions = buildMedicationSuggestions(args.patient, medicationData);
  const monitoringPlan = buildMonitoringPlan(args.patient, riskData, medicationData, activeConcerns);
  const doctorConsiderations = buildDoctorConsiderations(args.patient, riskData, medicationData);
  const evidenceSummary = buildEvidenceSummary(lifestyleData, medicationData, explainability);
  const nextSteps = buildNextSteps(
    activeConcerns,
    lifestyleSuggestions,
    medicationSuggestions,
    monitoringPlan,
  );

  return {
    patient_friendly_title: 'Comprehensive Diabetes Care Report',
    overview: buildOverview(args.patient, riskData, activeConcerns, protectiveFactors),
    latest_risk_summary: buildRiskSummary(args.patient, riskData, activeConcerns, protectiveFactors),
    risk_narrative: buildRiskNarrative(riskData, activeConcerns, protectiveFactors),
    clinical_snapshot: clinicalSnapshot,
    protective_factors: protectiveFactors,
    active_concerns: activeConcerns,
    risk_drivers: riskDrivers,
    lifestyle_suggestions: lifestyleSuggestions,
    medication_suggestions: medicationSuggestions,
    monitoring_plan: monitoringPlan,
    doctor_considerations: doctorConsiderations,
    evidence_summary: evidenceSummary,
    next_steps: nextSteps,
    explainability: explainability,
    conversation_id: args.conversationId,
  };
}

function joinSection(value: unknown, fallback = '') {
  const lines = flattenSentenceList(value);
  if (lines.length > 0) {
    return lines.map((line) => `- ${line}`).join('\n');
  }
  if (typeof value === 'string' && value.trim()) return value.trim();
  return fallback;
}

export function buildPatientCarePdfSections(content: Record<string, unknown>): Section[] {
  const sections: Section[] = [
    {
      heading: 'Overview',
      body: toText(content.overview) || 'This report summarizes the latest diabetes care picture for the patient.',
    },
    {
      heading: 'Risk Summary',
      body: toText(content.latest_risk_summary) || 'Risk summary not available.',
    },
    {
      heading: 'Risk Narrative',
      body: toText(content.risk_narrative) || '',
    },
    {
      heading: 'Clinical Snapshot',
      body: joinSection(content.clinical_snapshot, 'Clinical snapshot not available.'),
    },
    {
      heading: 'Protective Factors',
      body: joinSection(content.protective_factors, ''),
    },
    {
      heading: 'Active Concerns',
      body: joinSection(content.active_concerns, ''),
    },
    {
      heading: 'Key Risk Drivers',
      body: joinSection(content.risk_drivers, 'Key risk drivers were not available.'),
    },
    {
      heading: 'Lifestyle Recommendations',
      body: joinSection(content.lifestyle_suggestions, 'Lifestyle recommendations were not available.'),
    },
    {
      heading: 'Medication Considerations',
      body: joinSection(content.medication_suggestions, 'Medication considerations were not available.'),
    },
    {
      heading: 'Monitoring Plan',
      body: joinSection(content.monitoring_plan, 'Monitoring plan not available.'),
    },
    {
      heading: 'Doctor Considerations',
      body: joinSection(content.doctor_considerations, ''),
    },
    {
      heading: 'Evidence Summary',
      body: joinSection(content.evidence_summary, ''),
    },
    {
      heading: 'Next Steps',
      body: joinSection(content.next_steps, 'Next steps not available.'),
    },
  ];

  return sections.filter((section) => section.body.trim().length > 0);
}
