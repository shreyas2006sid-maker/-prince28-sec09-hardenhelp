"""Load JSON records into PostgreSQL with idempotent SHA-256 fingerprints.

Run: uv run python scripts/load_db.py
"""

import asyncio
import hashlib
import json
from datetime import date
from typing import Any

from sqlalchemy import select, update

from hardenhelp.config import get_settings
from hardenhelp.db.models import Document
from hardenhelp.db.session import make_engine, make_sessionmaker

TITLE_FIELD = "ssg_rule"
KNOWN = {"id", "title", "source_url", "licence", "doc_type", "published_on"}


def fingerprint(record: dict[str, Any]) -> str:
    canonical = json.dumps(record, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def to_row(record: dict[str, Any]) -> dict[str, Any]:
    external_id = record.get("id")
    if not isinstance(external_id, str) or not external_id:
        raise ValueError("every record must have a non-empty string 'id'")

    published = record.get("published_on")
    return {
        "external_id": external_id,
        "title": str(record.get("title") or record.get(TITLE_FIELD) or external_id),
        "source_url": record.get("source_url"),
        "licence": record.get("licence"),
        "doc_type": record.get("doc_type") or "record",
        "published_on": date.fromisoformat(published) if published else None,
        "sha256": fingerprint(record),
        "metadata_": {key: value for key, value in record.items() if key not in KNOWN},
    }


async def main() -> None:
    settings = get_settings()
    payload = json.loads(settings.data_file.read_text(encoding="utf-8"))
    if not isinstance(payload, list) or not all(isinstance(item, dict) for item in payload):
        raise ValueError(f"{settings.data_file} must contain a JSON array of records")

    rows = [to_row(record) for record in payload]
    ids = [row["external_id"] for row in rows]
    if len(ids) != len(set(ids)):
        raise ValueError("record IDs must be unique before loading")

    engine = make_engine(settings)
    session_factory = make_sessionmaker(engine)
    inserted = updated = unchanged = 0
    try:
        async with session_factory() as session, session.begin():
            result = await session.execute(select(Document.external_id, Document.sha256))
            existing = dict(result.all())
            for row in rows:
                old_fingerprint = existing.get(row["external_id"])
                if old_fingerprint is None:
                    session.add(Document(**row))
                    inserted += 1
                elif old_fingerprint != row["sha256"]:
                    await session.execute(
                        update(Document)
                        .where(Document.external_id == row["external_id"])
                        .values(**row)
                    )
                    updated += 1
                else:
                    unchanged += 1
    finally:
        await engine.dispose()

    print(f"records={len(payload)} inserted={inserted} updated={updated} unchanged={unchanged}")


if __name__ == "__main__":
    asyncio.run(main())
