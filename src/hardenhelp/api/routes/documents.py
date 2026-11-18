"""Document routes."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request

from hardenhelp.api.deps import get_store
from hardenhelp.api.errors import problem_response
from hardenhelp.store import Record, RecordStore

router = APIRouter(prefix="/v1")
StoreDependency = Annotated[RecordStore, Depends(get_store)]


@router.get("/documents")
def list_documents(
    request: Request,
    store: StoreDependency,
    limit: int = Query(default=20, ge=1, le=100),
    q: str | None = None,
    stig_id: str | None = None,
) -> dict[str, object]:
    items = store.list(q=q, stig_id=stig_id)
    return {"total": len(items), "items": [Record.model_validate(item) for item in items[:limit]]}


@router.get("/documents/{document_id}", response_model=Record)
def get_document(
    document_id: str,
    request: Request,
    store: StoreDependency,
):
    record = store.get(document_id)
    if record is None:
        return problem_response(
            request,
            404,
            "Not Found",
            f"No document with id '{document_id}'.",
        )
    return Record.model_validate(record)


@router.get("/stats")
def stats(store: StoreDependency) -> dict[str, object]:
    counts: dict[str, int] = {}
    for record in store.records:
        severity = str(record.get("severity") or "unknown")
        counts[severity] = counts.get(severity, 0) + 1
    return {"record_count": len(store.records), "severity_counts": counts}
