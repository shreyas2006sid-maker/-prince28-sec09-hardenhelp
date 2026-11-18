"""In-memory JSON record store."""

import json
from pathlib import Path
from typing import Any

from pydantic import BaseModel, ConfigDict


class Record(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str
    stig_id: str | None = None
    rule_id: str | None = None
    cci: str | list[str] | None = None
    ssg_rule: str | None = None
    severity: str | None = None
    os: str | None = None
    title: str
    check: str | None = None
    fix: str | None = None


class RecordStore:
    def __init__(self, path: Path) -> None:
        self.path = path
        self.records: list[dict[str, Any]] = []

    def load(self) -> None:
        try:
            payload = json.loads(self.path.read_text(encoding="utf-8"))
            if not isinstance(payload, list):
                raise ValueError("record file must contain a JSON array")
            self.records = payload
        except (OSError, json.JSONDecodeError, ValueError) as exc:
            raise RuntimeError(f"could not load records: {exc}") from exc

    def list(self, q: str | None = None, stig_id: str | None = None) -> list[dict[str, Any]]:
        records = self.records
        if stig_id:
            needle = stig_id.casefold()
            records = [
                record for record in records if str(record.get("stig_id", "")).casefold() == needle
            ]
        if q:
            needle = q.casefold()
            records = [
                record
                for record in records
                if needle in json.dumps(record, ensure_ascii=False).casefold()
            ]
        return records

    def get(self, record_id: str) -> dict[str, Any] | None:
        return next((record for record in self.records if record["id"] == record_id), None)
