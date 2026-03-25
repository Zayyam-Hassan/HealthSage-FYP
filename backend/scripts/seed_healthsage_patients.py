"""
Seed MongoDB with 3-4 healthy, 3-4 medium-risk, and 3-4 high-risk patients + observations.
Run once: python scripts/seed_healthsage_patients.py
Uses MONGO_URI, MONGO_DB_NAME from env (or defaults).
"""
from datetime import datetime, timezone

from bson import ObjectId

# Add project root to path
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db import get_db


def _utc() -> datetime:
    return datetime.now(timezone.utc)


def seed() -> None:
    db = get_db()
    patients = db.patients
    observations = db.observations

    # Avoid duplicate seed
    if patients.count_documents({}) > 0:
        print("Patients already exist; skip seeding. Delete collection to re-seed.")
        return

    # Observation codes aligned with training (observation_code in Mongo)
    def obs(patient_id: ObjectId, code: str, value_numeric: float | None = None, value_text: str | None = None, unit: str | None = None) -> dict:
        return {
            "patient_id": patient_id,
            "observation_code": code,
            "value_numeric": value_numeric,
            "value_text": value_text,
            "unit": unit,
            "effective_at": _utc(),
            "created_at": _utc(),
        }

    inserted_ids = []

    # ---- Healthy (3-4) ----
    healthy = [
        {"full_name": "Alice Green", "age": 32, "sex": "Female", "height_cm": 165, "weight_kg": 62},
        {"full_name": "Bob Smith", "age": 28, "sex": "Male", "height_cm": 178, "weight_kg": 75},
        {"full_name": "Carol White", "age": 45, "sex": "Female", "height_cm": 160, "weight_kg": 58},
        {"full_name": "David Brown", "age": 38, "sex": "Male", "height_cm": 172, "weight_kg": 78},
    ]
    for p in healthy:
        pid = patients.insert_one({
            **p,
            "created_at": _utc(),
            "updated_at": _utc(),
        }).inserted_id
        inserted_ids.append(("healthy", pid, p["full_name"]))
        # Normal / low risk values
        observations.insert_many([
            obs(pid, "HBA1C", 5.2, unit="%"),
            obs(pid, "RANDOM_GLUCOSE", 95, unit="mg/dL"),
            obs(pid, "BMI", 22.8),
            obs(pid, "SYSTOLIC_BP", 118),
            obs(pid, "DIASTOLIC_BP", 76),
            obs(pid, "TOTAL_CHOLESTEROL", 180),
            obs(pid, "HDL", 52),
            obs(pid, "LDL", 110),
            obs(pid, "TRIGLYCERIDES", 90),
            obs(pid, "DIABETES_LABEL", 0.0),
        ])

    # ---- Medium risk (3-4) ----
    medium = [
        {"full_name": "Eve Medium", "age": 52, "sex": "Female", "height_cm": 162, "weight_kg": 78},
        {"full_name": "Frank Gray", "age": 48, "sex": "Male", "height_cm": 175, "weight_kg": 92},
        {"full_name": "Grace Hill", "age": 55, "sex": "Female", "height_cm": 158, "weight_kg": 72},
        {"full_name": "Henry Lake", "age": 50, "sex": "Male", "height_cm": 180, "weight_kg": 95},
    ]
    for p in medium:
        pid = patients.insert_one({
            **p,
            "created_at": _utc(),
            "updated_at": _utc(),
        }).inserted_id
        inserted_ids.append(("medium", pid, p["full_name"]))
        observations.insert_many([
            obs(pid, "HBA1C", 6.2, unit="%"),
            obs(pid, "RANDOM_GLUCOSE", 128, unit="mg/dL"),
            obs(pid, "BMI", 29.5),
            obs(pid, "SYSTOLIC_BP", 132),
            obs(pid, "DIASTOLIC_BP", 84),
            obs(pid, "TOTAL_CHOLESTEROL", 215),
            obs(pid, "HDL", 42),
            obs(pid, "LDL", 140),
            obs(pid, "TRIGLYCERIDES", 155),
            obs(pid, "DIABETES_LABEL", 0.0),
        ])

    # ---- High risk (3-4) ----
    high = [
        {"full_name": "Ivy High", "age": 58, "sex": "Female", "height_cm": 155, "weight_kg": 82},
        {"full_name": "Jack Risk", "age": 62, "sex": "Male", "height_cm": 170, "weight_kg": 98},
        {"full_name": "Kate Severe", "age": 55, "sex": "Female", "height_cm": 160, "weight_kg": 88},
        {"full_name": "Leo Diab", "age": 60, "sex": "Male", "height_cm": 176, "weight_kg": 102},
    ]
    for p in high:
        pid = patients.insert_one({
            **p,
            "created_at": _utc(),
            "updated_at": _utc(),
        }).inserted_id
        inserted_ids.append(("high", pid, p["full_name"]))
        observations.insert_many([
            obs(pid, "HBA1C", 8.8, unit="%"),
            obs(pid, "RANDOM_GLUCOSE", 195, unit="mg/dL"),
            obs(pid, "BMI", 33.2),
            obs(pid, "SYSTOLIC_BP", 148),
            obs(pid, "DIASTOLIC_BP", 92),
            obs(pid, "TOTAL_CHOLESTEROL", 240),
            obs(pid, "HDL", 38),
            obs(pid, "LDL", 165),
            obs(pid, "TRIGLYCERIDES", 210),
            obs(pid, "DIABETES_LABEL", 1.0),
        ])

    print("Seeded patients and observations:")
    for risk, pid, name in inserted_ids:
        print(f"  [{risk}] {name}  id={pid}")

    # Seed doctors and medications for frontend (appointments, compatibility)
    if db.doctors.count_documents({}) == 0:
        db.doctors.insert_many([
            {"name": "Dr. Sarah Chen", "specialization": "Endocrinology", "email": "s.chen@health.example", "created_at": _utc(), "updated_at": _utc()},
            {"name": "Dr. James Wilson", "specialization": "Internal Medicine", "email": "j.wilson@health.example", "created_at": _utc(), "updated_at": _utc()},
            {"name": "Dr. Amy Lee", "specialization": "Diabetes Care", "phone": "+1-555-0100", "created_at": _utc(), "updated_at": _utc()},
        ])
        print("Seeded doctors.")
    if db.medications.count_documents({}) == 0:
        db.medications.insert_many([
            {"name": "Metformin", "brand_name": "Glucophage", "description": "First-line oral antidiabetic.", "side_effects": ["nausea", "diarrhea"], "warnings": ["Lactic acidosis risk"], "created_at": _utc(), "updated_at": _utc()},
            {"name": "Insulin Glargine", "brand_name": "Lantus", "side_effects": ["hypoglycemia", "weight gain"], "warnings": ["Dose adjustment needed"], "created_at": _utc(), "updated_at": _utc()},
            {"name": "Empagliflozin", "brand_name": "Jardiance", "side_effects": ["UTI", "thrush"], "warnings": ["Ketoacidosis"], "created_at": _utc(), "updated_at": _utc()},
        ])
        print("Seeded medications.")

    print("Done.")


if __name__ == "__main__":
    seed()
