from __future__ import annotations

import json
import os
from typing import Any, Dict, List

import httpx

from .async_utils import run_coro_sync

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass


LLM_BASE_URL = os.getenv("LLM_BASE_URL", "https://api.mistral.ai/v1/chat/completions")
LLM_API_KEY = os.getenv("LLM_API_KEY", "")
LLM_MODEL = os.getenv("LLM_MODEL", "mistral-large-latest")
LLM_TIMEOUT = float(os.getenv("LLM_TIMEOUT", "60"))

SYSTEM_PROMPT = (
    "You are a diabetes lifestyle assistant. "
    "You ONLY provide non-pharmacological, non-medication guidance "
    "about diet, exercise, sleep, stress, and smoking cessation. "
    "Never prescribe or modify medications or insulin."
)

GUIDELINE_SYSTEM_PROMPT = (
    "You are a diabetes and cardiovascular guideline expert. You cite ADA (American Diabetes Association) "
    "Standards of Medical Care in Diabetes, AHA/ACC, ESC, and similar evidence-based sources. "
    "You output only valid JSON, no markdown or extra text. "
    "Recommendations must be non-pharmacological lifestyle only (diet, activity, sleep, stress, smoking). "
    "For each guideline provide a short 'source' (e.g. ADA 2024) and a full 'reference' citation "
    "(e.g. 'ADA Standards of Medical Care in Diabetes 2024, Section 5. Diabetes Care 2024;47(Suppl 1):S77-S110')."
)

WEB_EXTRACT_SYSTEM_PROMPT = (
    "You extract diabetes lifestyle guidelines from web search results. "
    "You output only valid JSON, no markdown or extra text. "
    "Recommendations must be non-pharmacological only: diet, activity, sleep, stress, smoking. "
    "For each guideline use: \"category\" (diet, activity, sleep, behavior, general), \"text\" (one concrete recommendation), "
    "\"source\" (e.g. ADA 2024 or the page title), and \"reference\" (the exact URL from the search result for that guideline). "
    "Base your output only on the provided search results; do not invent guidelines. Prefer official ADA/diabetes.org/diabetesjournals.org sources."
)


def _extract_message_content(data: Dict[str, Any]) -> str:
    if "choices" in data:
        content = data["choices"][0].get("message", {}).get("content", "")
    else:
        content = data.get("message", {}).get("content", "")

    if isinstance(content, list):
        parts: List[str] = []
        for item in content:
            if isinstance(item, dict):
                parts.append(str(item.get("text", "")))
            else:
                parts.append(str(item))
        return "".join(parts).strip()

    return (content or "").strip()


def _strip_code_fences(content: str) -> str:
    text = (content or "").strip()
    if not text.startswith("```"):
        return text

    text = text.strip("`")
    lines = text.splitlines()
    if lines and lines[0].strip().lower().startswith("json"):
        return "\n".join(lines[1:]).strip()
    return text.strip()


async def _call_llm_async(system: str, user: str) -> str:
    if not LLM_API_KEY:
        raise RuntimeError("LLM_API_KEY is not set; configure it in your environment.")

    payload: Dict[str, Any] = {
        "model": LLM_MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    }
    headers = {
        "Authorization": f"Bearer {LLM_API_KEY}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=LLM_TIMEOUT) as client:
        resp = await client.post(LLM_BASE_URL, headers=headers, json=payload)
        resp.raise_for_status()
        data = resp.json()

    return _extract_message_content(data)


def _call_llm(system: str, user: str) -> str:
    return run_coro_sync(_call_llm_async(system, user))


def _normalize_guidelines(raw: Any, top_k: int, default_source: str) -> List[Dict[str, Any]]:
    if not isinstance(raw, list):
        return []

    guidelines: List[Dict[str, Any]] = []
    for item in raw[:top_k]:
        if not isinstance(item, dict) or not item.get("text"):
            continue
        guidelines.append(
            {
                "category": item.get("category", "general"),
                "text": str(item.get("text", "")).strip(),
                "source": item.get("source", default_source),
                "reference": item.get("reference", ""),
            }
        )
    return guidelines


def _infer_category(title: str, snippet: str) -> str:
    haystack = f"{title} {snippet}".lower()
    if any(token in haystack for token in ("sleep", "bedtime", "apnea", "insomnia")):
        return "sleep"
    if any(
        token in haystack
        for token in ("exercise", "activity", "walking", "aerobic", "resistance", "fitness", "sedentary")
    ):
        return "activity"
    if any(
        token in haystack
        for token in ("smok", "stress", "alcohol", "mindfulness", "behavior", "counsel", "cessation")
    ):
        return "behavior"
    if any(
        token in haystack
        for token in ("diet", "nutrition", "carb", "meal", "food", "fiber", "sodium", "weight", "vegetable")
    ):
        return "diet"
    return "general"


def normalize_guidelines_from_web_results(
    web_results: List[Dict[str, Any]],
    top_k: int = 12,
) -> List[Dict[str, Any]]:
    guidelines: List[Dict[str, Any]] = []
    seen_texts: set[str] = set()

    for result in web_results:
        title = str(result.get("title", "")).strip()
        link = str(result.get("link") or result.get("url") or "").strip()
        snippet = " ".join(str(result.get("snippet", "")).split()).strip()
        text = snippet or title
        if not text:
            continue

        normalized_text = text[:280].strip()
        dedupe_key = normalized_text.lower()
        if dedupe_key in seen_texts:
            continue
        seen_texts.add(dedupe_key)

        guidelines.append(
            {
                "category": _infer_category(title, snippet),
                "text": normalized_text,
                "source": title or "web",
                "reference": link,
            }
        )
        if len(guidelines) >= top_k:
            break

    return guidelines


async def fetch_guidelines_for_patient_async(
    context: Dict[str, Any],
    top_k: int = 16,
) -> List[Dict[str, Any]]:
    parts = [
        "Patient summary (use these to choose relevant guidelines):",
        f"- Age: {context.get('age')}, Sex: {context.get('sex')}",
        f"- BMI: {context.get('BMI')}, HbA1c: {context.get('HbA1c')} %, glucose: {context.get('glucose')} mg/dL",
        f"- Blood pressure: {context.get('systolic_bp')}/{context.get('diastolic_bp')} mmHg",
        f"- Total cholesterol: {context.get('cholesterol')}",
    ]
    parts.append(
        f"\nReturn a JSON array of {max(10, top_k)} guideline snippets relevant to this patient. "
        "Include multiple guidelines per category: at least 3-4 for diet, 2-3 for activity, 1-2 for sleep, 2-3 for behavior. "
        "Each object must have: \"category\" (one of: diet, activity, sleep, behavior, general), "
        "\"text\" (one concrete, actionable recommendation), \"source\" (e.g. ADA 2024), and "
        "\"reference\" (full citation, e.g. 'ADA Standards of Medical Care in Diabetes 2024, Section 5. Diabetes Care 2024;47(Suppl 1):S77-S110'). "
        "Tailor to their numbers: e.g. if HbA1c is high, include several diet/carb and activity guidelines; "
        "if BP is high, include sodium and aerobic activity; if BMI is high, include weight and activity. "
        "Use real ADA section references where possible. Output only the JSON array, no other text or markdown."
    )
    user_prompt = "\n".join(parts)
    content = _strip_code_fences(await _call_llm_async(GUIDELINE_SYSTEM_PROMPT, user_prompt))
    try:
        raw = json.loads(content)
        return _normalize_guidelines(raw, top_k=top_k, default_source="guideline")
    except (json.JSONDecodeError, TypeError):
        return []


def fetch_guidelines_for_patient(context: Dict[str, Any], top_k: int = 16) -> List[Dict[str, Any]]:
    return run_coro_sync(fetch_guidelines_for_patient_async(context, top_k=top_k))


async def extract_guidelines_from_web_results_async(
    web_results: List[Dict[str, Any]],
    context: Dict[str, Any],
    top_k: int = 16,
) -> List[Dict[str, Any]]:
    if not web_results:
        return []

    parts = [
        "Patient context (for relevance):",
        f"- Age: {context.get('age')}, Sex: {context.get('sex')}, BMI: {context.get('BMI')}",
        f"- HbA1c: {context.get('HbA1c')} %, glucose: {context.get('glucose')}, BP: {context.get('systolic_bp')}/{context.get('diastolic_bp')}",
        "",
        "Web search results (extract guidelines from these only; use the given URL as 'reference' for each):",
    ]
    for index, result in enumerate(web_results[:24], 1):
        title = result.get("title") or ""
        link = result.get("link") or ""
        snippet = result.get("snippet") or ""
        parts.append(f"[{index}] Title: {title}\nURL: {link}\nSnippet: {snippet}")
    parts.append(
        f"\nFrom the above search results, extract a JSON array of 10 to {max(10, top_k)} concrete lifestyle guidelines. "
        "Include multiple per category (diet, activity, sleep, behavior). "
        "Each object: \"category\", \"text\" (one actionable recommendation from the snippets), \"source\" (e.g. ADA 2024 or page title), "
        "\"reference\" (the URL from the result that supports this guideline). Use only information from the search results. "
        "Output only the JSON array, no other text or markdown."
    )
    user_prompt = "\n".join(parts)
    content = _strip_code_fences(await _call_llm_async(WEB_EXTRACT_SYSTEM_PROMPT, user_prompt))
    try:
        raw = json.loads(content)
        return _normalize_guidelines(raw, top_k=top_k, default_source="web")
    except (json.JSONDecodeError, TypeError):
        return []


def extract_guidelines_from_web_results(
    web_results: List[Dict[str, Any]],
    context: Dict[str, Any],
    top_k: int = 16,
) -> List[Dict[str, Any]]:
    return run_coro_sync(
        extract_guidelines_from_web_results_async(
            web_results,
            context,
            top_k=top_k,
        )
    )


def build_user_prompt(context: Dict[str, Any], guidelines: List[Dict[str, Any]]) -> str:
    parts = ["Patient summary:"]
    for key, value in context.items():
        parts.append(f"- {key}: {value}")

    parts.append("\nRelevant guideline snippets (with references):")
    for guideline in guidelines[:12]:
        ref = guideline.get("reference") or guideline.get("source", "")
        text = str(guideline.get("text", "")).strip()
        if len(text) > 280:
            text = f"{text[:277]}..."
        parts.append(f"- [{guideline.get('category', 'general')}] {text} (Ref: {ref})")

    parts.append(
        "\nWrite a JSON object with lifestyle recommendations under keys "
        "`diet`, `activity`, `sleep`, and `other`, each a list of 3-4 plain-language suggestions."
    )
    return "\n".join(parts)


async def generate_lifestyle_plan_async(
    context: Dict[str, Any],
    guidelines: List[Dict[str, Any]],
) -> str:
    prompt = build_user_prompt(context, guidelines)
    content = _strip_code_fences(await _call_llm_async(SYSTEM_PROMPT, prompt))

    try:
        json.loads(content)
        return content
    except json.JSONDecodeError:
        fallback = {
            "diet": [content],
            "activity": [],
            "sleep": [],
            "other": [],
        }
        return json.dumps(fallback)


def generate_lifestyle_plan(context: Dict[str, Any], guidelines: List[Dict[str, Any]]) -> str:
    return run_coro_sync(generate_lifestyle_plan_async(context, guidelines))
