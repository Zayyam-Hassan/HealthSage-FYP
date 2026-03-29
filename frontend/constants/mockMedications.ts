/**
 * Mock Medication Data
 * Front-end only, no backend integration
 */

export interface Medication {
  id: string;
  name: string;
  brand: string;
  description: string;
  dosage: string;
  sideEffects: string[];
  warnings: string[];
  contraindications: string[];
  category: string;
}

export const mockMedications: Medication[] = [
  {
    id: '1',
    name: 'Metformin',
    brand: 'Glucophage',
    description: 'Metformin is an oral diabetes medicine that helps control blood sugar levels. It works by helping to restore your body\'s proper response to the insulin you naturally produce.',
    dosage: '500mg - 1000mg twice daily',
    sideEffects: ['Nausea', 'Diarrhea', 'Stomach upset', 'Metallic taste'],
    warnings: ['May cause lactic acidosis', 'Avoid alcohol', 'Monitor kidney function'],
    contraindications: ['Kidney disease', 'Liver disease', 'Heart failure'],
    category: 'Antidiabetic',
  },
  {
    id: '2',
    name: 'Lisinopril',
    brand: 'Prinivil, Zestril',
    description: 'Lisinopril is an ACE inhibitor used to treat high blood pressure and heart failure. It works by relaxing blood vessels to allow blood to flow more easily.',
    dosage: '10mg - 40mg once daily',
    sideEffects: ['Dry cough', 'Dizziness', 'Headache', 'Fatigue'],
    warnings: ['May cause angioedema', 'Monitor potassium levels', 'Avoid during pregnancy'],
    contraindications: ['Pregnancy', 'History of angioedema', 'Bilateral renal artery stenosis'],
    category: 'ACE Inhibitor',
  },
  {
    id: '3',
    name: 'Atorvastatin',
    brand: 'Lipitor',
    description: 'Atorvastatin is a statin medication used to lower cholesterol and reduce the risk of heart disease. It works by blocking an enzyme needed to make cholesterol.',
    dosage: '10mg - 80mg once daily',
    sideEffects: ['Muscle pain', 'Joint pain', 'Nausea', 'Constipation'],
    warnings: ['May cause muscle damage', 'Monitor liver function', 'Avoid grapefruit'],
    contraindications: ['Active liver disease', 'Pregnancy', 'Breastfeeding'],
    category: 'Statin',
  },
  {
    id: '4',
    name: 'Aspirin',
    brand: 'Bayer, Ecotrin',
    description: 'Aspirin is used to reduce pain, fever, or inflammation. Low-dose aspirin is also used to prevent heart attacks and strokes.',
    dosage: '81mg - 325mg once daily (cardiac protection)',
    sideEffects: ['Stomach upset', 'Heartburn', 'Nausea', 'Bleeding risk'],
    warnings: ['May increase bleeding risk', 'Avoid before surgery', 'Monitor for GI bleeding'],
    contraindications: ['Active bleeding', 'Peptic ulcer disease', 'Aspirin allergy'],
    category: 'Antiplatelet',
  },
  {
    id: '5',
    name: 'Insulin Glargine',
    brand: 'Lantus, Basaglar',
    description: 'Insulin glargine is a long-acting insulin used to control blood sugar in people with diabetes. It works by helping glucose get into cells.',
    dosage: 'Dosage varies by individual needs',
    sideEffects: ['Low blood sugar', 'Weight gain', 'Injection site reactions'],
    warnings: ['Monitor blood sugar closely', 'Risk of hypoglycemia', 'Rotate injection sites'],
    contraindications: ['Hypoglycemia', 'Allergy to insulin'],
    category: 'Insulin',
  },
  {
    id: '6',
    name: 'Amlodipine',
    brand: 'Norvasc',
    description: 'Amlodipine is a calcium channel blocker used to treat high blood pressure and chest pain. It works by relaxing blood vessels.',
    dosage: '5mg - 10mg once daily',
    sideEffects: ['Swelling in ankles', 'Dizziness', 'Flushing', 'Headache'],
    warnings: ['May cause low blood pressure', 'Monitor for heart failure symptoms'],
    contraindications: ['Severe aortic stenosis', 'Hypotension'],
    category: 'Calcium Channel Blocker',
  },
  {
    id: '7',
    name: 'Omeprazole',
    brand: 'Prilosec',
    description: 'Omeprazole is a proton pump inhibitor used to treat acid reflux and stomach ulcers. It works by reducing stomach acid production.',
    dosage: '20mg - 40mg once daily',
    sideEffects: ['Headache', 'Diarrhea', 'Stomach pain', 'Nausea'],
    warnings: ['May increase fracture risk', 'May cause vitamin B12 deficiency'],
    contraindications: ['Hypersensitivity to omeprazole'],
    category: 'Proton Pump Inhibitor',
  },
  {
    id: '8',
    name: 'Levothyroxine',
    brand: 'Synthroid, Levoxyl',
    description: 'Levothyroxine is a thyroid hormone replacement used to treat hypothyroidism. It works by replacing thyroid hormone normally produced by the body.',
    dosage: 'Dosage varies by individual needs',
    sideEffects: ['Rapid heartbeat', 'Nervousness', 'Weight loss', 'Insomnia'],
    warnings: ['Take on empty stomach', 'Monitor thyroid levels', 'Avoid certain foods'],
    contraindications: ['Hyperthyroidism', 'Uncontrolled adrenal insufficiency'],
    category: 'Thyroid Hormone',
  },
];

export const getMedicationById = (id: string): Medication | undefined => {
  return mockMedications.find((m) => m.id === id);
};


