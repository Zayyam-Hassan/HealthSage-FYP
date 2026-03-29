/**
 * Mock Patient Data
 * Front-end only, no backend integration
 */

export interface Patient {
  id: string;
  name: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  email: string;
  phone: string;
  address: string;
  hba1c?: number;
  glucose?: number;
  bmi?: number;
  conditions: string[];
  vitalSigns: {
    bloodPressure: string;
    heartRate: number;
    temperature: number;
    oxygenSaturation: number;
  };
  riskScore?: number;
  riskClass?: 'low' | 'medium' | 'high';
  createdAt: string;
}

export const mockPatients: Patient[] = [
  {
    id: '1',
    name: 'John Doe',
    age: 45,
    gender: 'Male',
    email: 'john.doe@example.com',
    phone: '+1 (555) 123-4567',
    address: '123 Main St, New York, NY 10001',
    hba1c: 7.2,
    glucose: 145,
    bmi: 28.5,
    conditions: ['Type 2 Diabetes', 'Hypertension'],
    vitalSigns: {
      bloodPressure: '140/90',
      heartRate: 78,
      temperature: 98.6,
      oxygenSaturation: 98,
    },
    riskScore: 0.76,
    riskClass: 'high',
    createdAt: '2024-01-15',
  },
  {
    id: '2',
    name: 'Jane Smith',
    age: 38,
    gender: 'Female',
    email: 'jane.smith@example.com',
    phone: '+1 (555) 234-5678',
    address: '456 Oak Ave, Los Angeles, CA 90001',
    hba1c: 5.8,
    glucose: 95,
    bmi: 22.3,
    conditions: ['Asthma'],
    vitalSigns: {
      bloodPressure: '120/80',
      heartRate: 72,
      temperature: 98.4,
      oxygenSaturation: 99,
    },
    riskScore: 0.32,
    riskClass: 'low',
    createdAt: '2024-02-10',
  },
  {
    id: '3',
    name: 'Robert Johnson',
    age: 62,
    gender: 'Male',
    email: 'robert.j@example.com',
    phone: '+1 (555) 345-6789',
    address: '789 Pine Rd, Chicago, IL 60601',
    hba1c: 8.1,
    glucose: 180,
    bmi: 31.2,
    conditions: ['Type 2 Diabetes', 'Hypertension', 'Heart Disease'],
    vitalSigns: {
      bloodPressure: '155/95',
      heartRate: 85,
      temperature: 98.8,
      oxygenSaturation: 96,
    },
    riskScore: 0.89,
    riskClass: 'high',
    createdAt: '2024-01-20',
  },
  {
    id: '4',
    name: 'Maria Garcia',
    age: 29,
    gender: 'Female',
    email: 'maria.g@example.com',
    phone: '+1 (555) 456-7890',
    address: '321 Elm St, Houston, TX 77001',
    hba1c: 5.5,
    glucose: 88,
    bmi: 21.8,
    conditions: [],
    vitalSigns: {
      bloodPressure: '110/70',
      heartRate: 68,
      temperature: 98.2,
      oxygenSaturation: 99,
    },
    riskScore: 0.15,
    riskClass: 'low',
    createdAt: '2024-03-05',
  },
  {
    id: '5',
    name: 'David Lee',
    age: 55,
    gender: 'Male',
    email: 'david.lee@example.com',
    phone: '+1 (555) 567-8901',
    address: '654 Maple Dr, Phoenix, AZ 85001',
    hba1c: 6.8,
    glucose: 125,
    bmi: 26.7,
    conditions: ['Type 2 Diabetes', 'Obesity'],
    vitalSigns: {
      bloodPressure: '135/85',
      heartRate: 80,
      temperature: 98.5,
      oxygenSaturation: 97,
    },
    riskScore: 0.58,
    riskClass: 'medium',
    createdAt: '2024-02-28',
  },
];

export const getPatientById = (id: string): Patient | undefined => {
  return mockPatients.find((p) => p.id === id);
};


