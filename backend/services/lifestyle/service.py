from __future__ import annotations

from typing import Any, Dict

from starlette.concurrency import run_in_threadpool

from .async_utils import run_coro_sync
from .context_builder import build_patient_context
from .guideline_retriever import retrieve_guidelines_async
from .llm_engine import generate_lifestyle_plan_async
from .validator import validate_lifestyle_json


def generate_and_store_lifestyle_recs(patient_id: str) -> Dict[str, Any]:
    return run_coro_sync(generate_and_store_lifestyle_recs_async(patient_id))


async def generate_and_store_lifestyle_recs_async(patient_id: str) -> Dict[str, Any]:
    context = await run_in_threadpool(build_patient_context, patient_id)
    guidelines = await retrieve_guidelines_async(context, top_k=12)
    raw_json = await generate_lifestyle_plan_async(context, guidelines)
    plan = await run_in_threadpool(validate_lifestyle_json, raw_json)

    return {
        "patient_id": patient_id,
        "context": context,
        "guidelines_used": [
            {
                "text": guideline.get("text"),
                "category": guideline.get("category"),
                "source": guideline.get("source"),
                "reference": guideline.get("reference"),
            }
            for guideline in guidelines
        ],
        "plan": plan.model_dump(),
    }
