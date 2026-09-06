"""
Bootstrap MongoDB for HealthSage lifestyle + guideline features.

This will:
- connect to MongoDB using MONGO_URI (default: mongodb://localhost:27017)
- create the `healthsage` database (or the value of MONGO_DB_NAME)
- create collections:
    - patients
    - guideline_chunks
    - lifestyle_recommendations
- insert one demo patient and one demo guideline chunk so you can test the API.
"""

from datetime import datetime
import os

from bson import ObjectId
from pymongo import MongoClient


MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("MONGO_DB_NAME", "healthsage")
PATIENT_COLLECTION = os.getenv("MONGO_PATIENT_COLLECTION", "patients")
GUIDELINE_COLLECTION = os.getenv("MONGO_GUIDELINE_COLLECTION", "guideline_chunks")
LIFESTYLE_COLLECTION = os.getenv("MONGO_LIFESTYLE_COLLECTION", "lifestyle_recommendations")


def main() -> None:
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]

    patients = db[PATIENT_COLLECTION]
    guidelines = db[GUIDELINE_COLLECTION]
    lifestyle = db[LIFESTYLE_COLLECTION]

    # Create a demo patient if none exists.
    if patients.count_documents({}) == 0:
        demo_id = ObjectId()
        patients.insert_one(
            {
                "_id": demo_id,
                "age": 55,
                "sex": "male",
                "bmi": 31.2,
                "hba1c": 8.1,
                "glucose": 165,
                "cholesterol": 210,
                "systolic_bp": 138,
                "diastolic_bp": 86,
                "activity_level": "low",
                "smoker": True,
                "diabetes_risk_score": 0.82,
                "created_at": datetime.utcnow(),
            }
        )
        print(f"Inserted demo patient with _id={demo_id}")
    else:
        demo_id = patients.find_one({}, {"_id": 1})["_id"]
        print(f"Using existing patient with _id={demo_id}")

    # Create a demo guideline chunk if none exists.
    if guidelines.count_documents({}) == 0:
        guidelines.insert_one(
            {
                "source": "ADA-2025",
                "category": "lifestyle",
                "text": "For patients with type 2 diabetes, encourage at least 150 minutes "
                        "of moderate-intensity aerobic activity per week, spread over at "
                        "least 3 days, with no more than 2 consecutive days without activity.",
                "embedding": [],  # can be filled later by an offline embedding job
                "created_at": datetime.utcnow(),
            }
        )
        print("Inserted demo ADA-2025 guideline chunk.")
    else:
        print("Guideline chunks already present; not inserting demo guideline.")

    # Just touch the lifestyle collection so it exists.
    if lifestyle.count_documents({}) == 0:
        lifestyle.insert_one(
            {
                "patient_id": str(demo_id),
                "context": {},
                "guidelines": [],
                "plan": {"diet": [], "activity": [], "sleep": [], "other": []},
                "created_at": datetime.utcnow(),
                "note": "placeholder document to create collection; can be deleted.",
            }
        )
        print("Created lifestyle_recommendations collection with a placeholder document.")
    else:
        print("lifestyle_recommendations collection already has data.")

    print("\nMongoDB bootstrap completed.")
    print(f"Demo patient id (use in API): {demo_id}")


if __name__ == "__main__":
    main()

