"""
Provider-agnostic LLM layer for D-HealthSage.
Supports Grok and Mistral via a single generate() interface with optional lifecycle callbacks.
"""
from __future__ import annotations

from .client import generate

__all__ = ["generate"]
