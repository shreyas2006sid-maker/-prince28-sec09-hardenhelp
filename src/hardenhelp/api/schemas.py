"""API response models."""

from typing import Any

from pydantic import BaseModel, ConfigDict


class Record(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str
    title: str
    doc_type: str = "record"
    source_url: str | None = None
    licence: str | None = None
    published_on: str | None = None


class DocumentList(BaseModel):
    total: int
    items: list[Record]
    filters: dict[str, str] | None = None


class DocumentStats(BaseModel):
    record_count: int
    severity_counts: dict[str, int]


class DocumentMetadata(BaseModel):
    values: dict[str, Any]
