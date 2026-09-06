/**
 * Seeds time-series trend data so the Trends screen has something to show:
 *  - observations: glucose, fasting glucose, HbA1c, BMI, blood pressure over time
 *  - risk_predictions: a multi-month risk progression
 *
 * Generated series end near each patient's CURRENT recorded values so the
 * charts stay consistent with their clinical profile.
 *
 * Idempotent: re-running first removes its own previously seeded rows
 * (observations tagged { seeded: true }, risk_predictions model_name 'seeded_trend').
 *
 * Run:  node scripts/seed-trends-data.js
 */
const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const SEED_TAG = 'seeded_trend';

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function round(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function daysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  // jitter the time of day a little so points are not all at midnight
  d.setHours(8 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 60), 0, 0);
  return d;
}

/**
 * Build a series of { value, at } ending (newest) exactly at currentValue.
 * The oldest point drifts away from current by a small random amount, and
 * intermediate points interpolate with light noise.
 */
function buildSeries(currentValue, opts) {
  const { points, spanDays, noisePct, min, max, decimals } = opts;
  const drift = (Math.random() * 2 - 1) * 0.16; // +/-16% start offset
  const startValue = clamp(currentValue * (1 + drift), min, max);
  const series = [];
  for (let i = 0; i < points; i += 1) {
    const t = i / (points - 1); // 0 (oldest) -> 1 (newest)
    const base = startValue + (currentValue - startValue) * t;
    const noise = i === points - 1 ? 0 : base * (Math.random() * 2 - 1) * noisePct;
    const value = clamp(round(base + noise, decimals), min, max);
    const at = daysAgo(Math.round(spanDays * (1 - t)));
    series.push({ value, at });
  }
  return series;
}

const METRICS = [
  {
    code: 'RANDOM_GLUCOSE',
    unit: 'mg/dL',
    read: (p) => p.lab_tests && p.lab_tests.glucose,
    opts: { points: 20, spanDays: 30, noisePct: 0.06, min: 60, max: 320, decimals: 0 },
  },
  {
    code: 'FASTING_GLUCOSE',
    unit: 'mg/dL',
    read: (p) => p.lab_tests && p.lab_tests.fasting_glucose,
    opts: { points: 12, spanDays: 36, noisePct: 0.05, min: 55, max: 260, decimals: 0 },
  },
  {
    code: 'HBA1C',
    unit: '%',
    read: (p) => p.lab_tests && p.lab_tests.hba1c,
    opts: { points: 6, spanDays: 165, noisePct: 0.03, min: 4.2, max: 13, decimals: 1 },
  },
  {
    code: 'BMI',
    unit: 'kg/m2',
    read: (p) => p.vital_signs && p.vital_signs.bmi,
    opts: { points: 10, spanDays: 70, noisePct: 0.02, min: 15, max: 50, decimals: 1 },
  },
];

// Systolic + diastolic share timestamps so the dual-line chart lines up.
const BP_SYS = {
  code: 'BLOOD_PRESSURE_SYSTOLIC',
  read: (p) => p.vital_signs && p.vital_signs.systolic_bp,
  opts: { points: 12, spanDays: 30, noisePct: 0.04, min: 90, max: 200, decimals: 0 },
};
const BP_DIA = {
  code: 'BLOOD_PRESSURE_DIASTOLIC',
  read: (p) => p.vital_signs && p.vital_signs.diastolic_bp,
  opts: { points: 12, spanDays: 30, noisePct: 0.04, min: 55, max: 130, decimals: 0 },
};

function scoreToLabel(score) {
  if (score < 0.3) return 'low';
  if (score < 0.7) return 'medium';
  return 'high';
}

function heuristicProbability(patient) {
  const hba1c = patient.lab_tests && patient.lab_tests.hba1c;
  if (typeof hba1c === 'number') {
    return clamp((hba1c - 5.0) / 5.0, 0.05, 0.95);
  }
  const glucose =
    (patient.lab_tests && (patient.lab_tests.glucose || patient.lab_tests.fasting_glucose)) || null;
  if (typeof glucose === 'number') {
    return clamp((glucose - 90) / 160, 0.05, 0.95);
  }
  return 0.3;
}

async function seedObservationsForPatient(observations, patient) {
  const docs = [];

  for (const metric of METRICS) {
    const current = metric.read(patient);
    if (typeof current !== 'number' || !Number.isFinite(current)) continue;
    for (const point of buildSeries(current, metric.opts)) {
      docs.push({
        patient_id: patient._id,
        observation_code: metric.code,
        value_numeric: point.value,
        unit: metric.unit,
        effective_at: point.at,
        created_at: point.at,
        neo4j_synced_at: null,
        seeded: true,
      });
    }
  }

  // Blood pressure: build systolic, then mirror its timestamps for diastolic.
  const sysCurrent = BP_SYS.read(patient);
  const diaCurrent = BP_DIA.read(patient);
  if (
    typeof sysCurrent === 'number' &&
    typeof diaCurrent === 'number' &&
    Number.isFinite(sysCurrent) &&
    Number.isFinite(diaCurrent)
  ) {
    const sysSeries = buildSeries(sysCurrent, BP_SYS.opts);
    const diaSeries = buildSeries(diaCurrent, BP_DIA.opts);
    for (let i = 0; i < sysSeries.length; i += 1) {
      const at = sysSeries[i].at;
      docs.push({
        patient_id: patient._id,
        observation_code: BP_SYS.code,
        value_numeric: sysSeries[i].value,
        unit: 'mmHg',
        effective_at: at,
        created_at: at,
        neo4j_synced_at: null,
        seeded: true,
      });
      docs.push({
        patient_id: patient._id,
        observation_code: BP_DIA.code,
        value_numeric: diaSeries[i].value,
        unit: 'mmHg',
        effective_at: at,
        created_at: at,
        neo4j_synced_at: null,
        seeded: true,
      });
    }
  }

  await observations.deleteMany({ patient_id: patient._id, seeded: true });
  if (docs.length > 0) {
    await observations.insertMany(docs);
  }
  return docs.length;
}

async function seedRiskHistoryForPatient(riskPredictions, patient) {
  const latest = await riskPredictions
    .find({ patient_id: patient._id })
    .sort({ created_at: -1 })
    .limit(1)
    .toArray();

  const currentProb =
    latest.length > 0 && typeof latest[0].probability === 'number'
      ? latest[0].probability
      : heuristicProbability(patient);

  const points = 6;
  const spanDays = 165;
  const drift = (Math.random() * 2 - 1) * 0.22;
  const startProb = clamp(currentProb * (1 + drift), 0.03, 0.97);

  const docs = [];
  for (let i = 0; i < points; i += 1) {
    const t = i / (points - 1);
    const base = startProb + (currentProb - startProb) * t;
    const noise = i === points - 1 ? 0 : (Math.random() * 2 - 1) * 0.04;
    const prob = clamp(round(base + noise, 4), 0.02, 0.98);
    // newest point sits ~5 days ago so it does not stack on other "now" rows
    const at = daysAgo(Math.round(5 + spanDays * (1 - t)));
    docs.push({
      patient_id: patient._id,
      model_name: SEED_TAG,
      probability: prob,
      predicted_label: prob >= 0.5 ? 1 : 0,
      explanation: {
        seeded: true,
        risk_label: scoreToLabel(prob),
        summary: `Seeded ${scoreToLabel(prob)} risk snapshot for trend demo.`,
      },
      created_at: at,
    });
  }

  await riskPredictions.deleteMany({ patient_id: patient._id, model_name: SEED_TAG });
  if (docs.length > 0) {
    await riskPredictions.insertMany(docs);
  }
  return docs.length;
}

async function main() {
  if (!process.env.MONGO_URI || !process.env.MONGO_DB_NAME) {
    throw new Error('MONGO_URI and MONGO_DB_NAME must be set in express-backend/.env');
  }

  await mongoose.connect(process.env.MONGO_URI, {
    dbName: process.env.MONGO_DB_NAME,
    serverSelectionTimeoutMS: 8000,
  });

  const db = mongoose.connection.db;
  const patients = db.collection('patients');
  const observations = db.collection('observations');
  const riskPredictions = db.collection('risk_predictions');

  const allPatients = await patients.find({}).toArray();
  console.log(`Found ${allPatients.length} patient(s). Seeding trend data...`);

  let obsTotal = 0;
  let riskTotal = 0;
  let touched = 0;

  for (const patient of allPatients) {
    const obsCount = await seedObservationsForPatient(observations, patient);
    const riskCount = await seedRiskHistoryForPatient(riskPredictions, patient);
    obsTotal += obsCount;
    riskTotal += riskCount;
    if (obsCount > 0 || riskCount > 0) {
      touched += 1;
      console.log(
        `  - ${patient.full_name || patient.patient_id || patient._id}: ` +
          `${obsCount} observations, ${riskCount} risk points`,
      );
    }
  }

  console.log('---');
  console.log(`Seeded ${obsTotal} observations and ${riskTotal} risk points across ${touched} patient(s).`);
}

main()
  .catch((error) => {
    console.error('Trend seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => undefined);
  });
