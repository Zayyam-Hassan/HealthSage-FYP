/**
 * Mock Risk Prediction Data
 * Front-end only, no backend integration
 */

export interface RiskPrediction {
  risk_score: number;
  risk_class: 'low' | 'medium' | 'high';
  confidence: number;
  factors: {
    clinical: string[];
    lifestyle: string[];
    genetic: string[];
  };
  recommendations: string[];
  clinicalSummary: string;
}

export const generateMockRisk = (patientId?: string): RiskPrediction => {
  // Generate random risk score between 0 and 1
  const riskScore = Math.random();
  
  let riskClass: 'low' | 'medium' | 'high';
  if (riskScore < 0.4) {
    riskClass = 'low';
  } else if (riskScore < 0.7) {
    riskClass = 'medium';
  } else {
    riskClass = 'high';
  }

  const confidence = 0.75 + Math.random() * 0.2; // 0.75 to 0.95

  const clinicalFactors = [
    'Elevated HbA1c levels',
    'High blood pressure',
    'Elevated BMI',
    'Abnormal glucose levels',
    'History of cardiovascular disease',
  ];

  const lifestyleFactors = [
    'Sedentary lifestyle',
    'Poor diet',
    'Smoking history',
    'Alcohol consumption',
    'Stress levels',
  ];

  const geneticFactors = [
    'Family history of diabetes',
    'Genetic predisposition',
    'Ethnic background',
  ];

  const recommendations = [
    'Maintain regular exercise routine',
    'Follow a balanced diet',
    'Monitor blood glucose levels regularly',
    'Attend regular check-ups',
    'Consider medication adjustments',
  ];

  const summaries = {
    low: 'Patient shows low risk indicators. Current management appears effective. Continue monitoring and maintain healthy lifestyle habits.',
    medium: 'Patient shows moderate risk indicators. Some areas require attention. Consider lifestyle modifications and closer monitoring.',
    high: 'Patient shows high risk indicators. Immediate attention recommended. Consider comprehensive treatment plan and frequent monitoring.',
  };

  return {
    risk_score: parseFloat(riskScore.toFixed(2)),
    risk_class: riskClass,
    confidence: parseFloat(confidence.toFixed(2)),
    factors: {
      clinical: clinicalFactors.slice(0, Math.floor(Math.random() * 3) + 2),
      lifestyle: lifestyleFactors.slice(0, Math.floor(Math.random() * 2) + 1),
      genetic: geneticFactors.slice(0, Math.floor(Math.random() * 2) + 1),
    },
    recommendations: recommendations.slice(0, Math.floor(Math.random() * 3) + 2),
    clinicalSummary: summaries[riskClass],
  };
};

export const mockRisk: RiskPrediction = {
  risk_score: 0.76,
  risk_class: 'high',
  confidence: 0.89,
  factors: {
    clinical: ['Elevated HbA1c levels', 'High blood pressure', 'Elevated BMI'],
    lifestyle: ['Sedentary lifestyle', 'Poor diet'],
    genetic: ['Family history of diabetes'],
  },
  recommendations: [
    'Maintain regular exercise routine',
    'Follow a balanced diet',
    'Monitor blood glucose levels regularly',
    'Attend regular check-ups',
  ],
  clinicalSummary: 'Patient shows high risk indicators. Immediate attention recommended. Consider comprehensive treatment plan and frequent monitoring.',
};


