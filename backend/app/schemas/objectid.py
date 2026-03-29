"""Pydantic v2 support for MongoDB ObjectId: validate str/ObjectId, serialize to str in JSON."""
from typing import Any

from bson import ObjectId
from pydantic import GetCoreSchemaHandler
from pydantic_core import core_schema


class PyObjectId(str):
    """Use in Pydantic models for fields that store MongoDB ObjectId. Accepts str or ObjectId; JSON serializes to str."""

    @classmethod
    def __get_pydantic_core_schema__(
        cls, source_type: Any, handler: GetCoreSchemaHandler
    ) -> core_schema.CoreSchema:
        return core_schema.union_schema(
            [
                core_schema.is_instance_schema(ObjectId),
                core_schema.no_info_plain_validator_function(cls._validate),
            ],
            serialization=core_schema.plain_serializer_function_ser_schema(
                lambda x: str(x) if isinstance(x, ObjectId) else x
            ),
        )

    @classmethod
    def _validate(cls, v: Any) -> ObjectId:
        if isinstance(v, ObjectId):
            return v
        if isinstance(v, str) and len(v) == 24:
            try:
                return ObjectId(v)
            except Exception:
                pass
        raise ValueError("invalid ObjectId")
