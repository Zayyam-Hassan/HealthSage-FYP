from __future__ import annotations

from typing import Any, Dict, List

from .async_utils import run_coro_sync
from .llm_engine import (
    LLM_API_KEY,
    fetch_guidelines_for_patient_async,
    normalize_guidelines_from_web_results,
)
from .web_search import SERPER_API_KEY, fetch_web_results_for_guidelines_async

_STATIC_GUIDELINES: List[Dict[str, Any]] = [
    {
        "source": "ADA 2024",
        "category": "diet",
        "text": "Encourage a Mediterranean-style or similar eating pattern rich in vegetables, whole grains, legumes, nuts, and olive oil.",
        "reference": "ADA Standards of Medical Care in Diabetes 2024, Section 5: Facilitating Positive Health Behaviors and Well-being. Diabetes Care 2024;47(Suppl 1):S77-S110.",
    },
    {
        "source": "ADA 2024",
        "category": "diet",
        "text": "Limit or avoid sugary drinks and ultra-processed foods; emphasize minimally processed whole foods.",
        "reference": "ADA Standards of Medical Care in Diabetes 2024, Section 5. Diabetes Care 2024;47(Suppl 1):S77-S110.",
    },
    {
        "source": "ADA 2024",
        "category": "diet",
        "text": "Individualize carbohydrate intake using glycemic index/load and portion control to improve postprandial glucose.",
        "reference": "ADA Standards of Medical Care in Diabetes 2024, Section 5 (Medical Nutrition Therapy). Diabetes Care 2024;47(Suppl 1):S77-S110.",
    },
    {
        "source": "ADA 2024",
        "category": "diet",
        "text": "Recommend adequate dietary fiber (at least 14 g per 1,000 kcal) from vegetables, legumes, and whole grains.",
        "reference": "ADA Standards of Medical Care in Diabetes 2024, Section 5. Diabetes Care 2024;47(Suppl 1):S77-S110.",
    },
    {
        "source": "ADA 2024",
        "category": "diet",
        "text": "For weight management, reduce energy intake while maintaining a healthful eating pattern; avoid restrictive fad diets.",
        "reference": "ADA Standards of Medical Care in Diabetes 2024, Section 8: Obesity and Weight Management. Diabetes Care 2024;47(Suppl 1):S126-S132.",
    },
    {
        "source": "ADA 2024",
        "category": "activity",
        "text": "Aim for at least 150 minutes per week of moderate-intensity aerobic activity, spread over at least 3 days with no more than 2 consecutive days without activity.",
        "reference": "ADA Standards of Medical Care in Diabetes 2024, Section 5 (Physical Activity). Diabetes Care 2024;47(Suppl 1):S77-S110.",
    },
    {
        "source": "ADA 2024",
        "category": "activity",
        "text": "Add 2-3 sessions per week of resistance exercise on nonconsecutive days for additional glycemic and strength benefits.",
        "reference": "ADA Standards of Medical Care in Diabetes 2024, Section 5. Diabetes Care 2024;47(Suppl 1):S77-S110.",
    },
    {
        "source": "ADA 2024",
        "category": "activity",
        "text": "Reduce sedentary time; break up prolonged sitting with short bouts of light activity every 30 minutes when possible.",
        "reference": "ADA Standards of Medical Care in Diabetes 2024, Section 5. Diabetes Care 2024;47(Suppl 1):S77-S110.",
    },
    {
        "source": "ADA 2024",
        "category": "activity",
        "text": "For older adults, include flexibility and balance training (e.g., yoga, tai chi) to reduce fall risk.",
        "reference": "ADA Standards of Medical Care in Diabetes 2024, Section 5. Diabetes Care 2024;47(Suppl 1):S77-S110.",
    },
    {
        "source": "ADA 2024",
        "category": "sleep",
        "text": "Promote consistent sleep schedules and good sleep hygiene, targeting 7-9 hours of quality sleep per night.",
        "reference": "ADA Standards of Medical Care in Diabetes 2024, Section 5 (Facilitating Positive Health Behaviors). Diabetes Care 2024;47(Suppl 1):S77-S110.",
    },
    {
        "source": "ADA 2024",
        "category": "sleep",
        "text": "Address sleep disorders (e.g., obstructive sleep apnea) when suspected; poor sleep is linked to worse glycemic control.",
        "reference": "ADA Standards of Medical Care in Diabetes 2024, Section 5. Diabetes Care 2024;47(Suppl 1):S77-S110.",
    },
    {
        "source": "ADA 2024",
        "category": "behavior",
        "text": "Advise complete smoking cessation and offer counseling and pharmacotherapy as needed; avoid e-cigarettes for cessation.",
        "reference": "ADA Standards of Medical Care in Diabetes 2024, Section 5 (Smoking Cessation). Diabetes Care 2024;47(Suppl 1):S77-S110.",
    },
    {
        "source": "ADA 2024",
        "category": "behavior",
        "text": "Recommend stress-management techniques such as mindfulness, relaxation exercises, or counseling to support self-care and well-being.",
        "reference": "ADA Standards of Medical Care in Diabetes 2024, Section 5 (Psychosocial Care). Diabetes Care 2024;47(Suppl 1):S77-S110.",
    },
    {
        "source": "ADA 2024",
        "category": "behavior",
        "text": "Limit alcohol intake; if consumed, do so in moderation with food and with awareness of hypoglycemia risk.",
        "reference": "ADA Standards of Medical Care in Diabetes 2024, Section 5. Diabetes Care 2024;47(Suppl 1):S77-S110.",
    },
]


def retrieve_guidelines(context: Dict[str, Any], top_k: int = 20) -> List[Dict[str, Any]]:
    return run_coro_sync(retrieve_guidelines_async(context, top_k=top_k))


async def retrieve_guidelines_async(context: Dict[str, Any], top_k: int = 20) -> List[Dict[str, Any]]:
    if SERPER_API_KEY:
        try:
            web_results = await fetch_web_results_for_guidelines_async(
                context,
                max_results_per_query=4,
            )
            if web_results:
                guidelines = normalize_guidelines_from_web_results(
                    web_results,
                    top_k=max(top_k, 12),
                )
                if guidelines:
                    return guidelines[:top_k]
        except Exception:
            pass

    if LLM_API_KEY:
        try:
            guidelines = await fetch_guidelines_for_patient_async(
                context,
                top_k=max(top_k, 12),
            )
            if guidelines:
                return guidelines[:top_k]
        except Exception:
            pass

    return _STATIC_GUIDELINES[:top_k]
