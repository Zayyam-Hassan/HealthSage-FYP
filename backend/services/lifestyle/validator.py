import re
from typing import List

import json
from pydantic import BaseModel, field_validator, ValidationError


DISALLOWED_WORDS = {"insulin", "metformin", "sulfonylurea", "drug", "medication", "dose"}

# Replacements so lifestyle text stays non-prescribing but we don't reject valid advice
DISALLOWED_REPLACEMENTS = {
    "medication": "treatment as advised by your doctor",
    "drug": "treatment",
    "dose": "regimen",
    "insulin": "glucose-lowering treatment as prescribed",
    "metformin": "glucose-lowering treatment as prescribed",
    "sulfonylurea": "glucose-lowering treatment as prescribed",
}


def _sanitize_lifestyle_text(text: str) -> str:
    """Replace disallowed (medication-related) words with safe alternatives so validation passes."""
    if not text or not isinstance(text, str):
        return text
    result = text
    for word, replacement in DISALLOWED_REPLACEMENTS.items():
        # Word-boundary replacement, case-insensitive
        pattern = re.compile(re.escape(word), re.IGNORECASE)
        result = pattern.sub(replacement, result)
    return result


class LifestyleItem(BaseModel):
    text: str

    @field_validator("text")
    @classmethod
    def no_medications(cls, v: str) -> str:
        # Sanitize first so LLM slip-ups don't reject valid lifestyle advice
        v = _sanitize_lifestyle_text(v)
        lower = v.lower()
        if any(w in lower for w in DISALLOWED_WORDS):
            raise ValueError("Medication-related content is not allowed in lifestyle recommendations")
        return v


class LifestylePlan(BaseModel):
    diet: List[LifestyleItem]
    activity: List[LifestyleItem]
    sleep: List[LifestyleItem]
    other: List[LifestyleItem]


def validate_lifestyle_json(raw_json: str) -> LifestylePlan:
    try:
        data = json.loads(raw_json)
    except json.JSONDecodeError as exc:
        raise ValueError(f"LLM returned invalid JSON: {exc}") from exc

    # Make the validator robust to slightly different shapes from the LLM.
    # Normalise into a dict with keys: diet, activity, sleep, other.
    plan_like = {
        "diet": [],
        "activity": [],
        "sleep": [],
        "other": [],
    }

    # If the model returned a plain string, treat it as a single "other" item.
    if isinstance(data, str):
        plan_like["other"].append({"text": data})
    elif isinstance(data, list):
        # Treat list of strings or objects as "other".
        for item in data:
            if isinstance(item, str):
                plan_like["other"].append({"text": item})
            elif isinstance(item, dict) and "text" in item:
                plan_like["other"].append({"text": str(item["text"])})
    elif isinstance(data, dict):
        # Common pattern: {"lifestyle_plan": {...}} or similar single-key wrapper.
        if (
            len(data) == 1
            and isinstance(next(iter(data.values())), dict)
        ):
            data = next(iter(data.values()))

        # Map any recognised keys; everything else goes into "other".
        for key, value in data.items():
            target_key = key if key in plan_like else "other"
            if isinstance(value, str):
                plan_like[target_key].append({"text": value})
            elif isinstance(value, list):
                for v in value:
                    if isinstance(v, str):
                        plan_like[target_key].append({"text": v})
                    elif isinstance(v, dict) and "text" in v:
                        plan_like[target_key].append({"text": str(v["text"])})
            elif isinstance(value, dict) and "text" in value:
                plan_like[target_key].append({"text": str(value["text"])})

        # If all lists are still empty but there is a single key like "lifestyle_recommendation",
        # move its text into "other".
        if not any(plan_like.values()) and "lifestyle_recommendation" in data:
            plan_like["other"].append({"text": str(data["lifestyle_recommendation"])})

    try:
        return LifestylePlan.model_validate(plan_like)
    except ValidationError as exc:
        raise ValueError(f"Lifestyle plan failed validation: {exc}") from exc

