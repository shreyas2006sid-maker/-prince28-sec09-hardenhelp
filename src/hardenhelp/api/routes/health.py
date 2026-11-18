"""Liveness and readiness endpoints."""

from fastapi import APIRouter, Request, Response, status

from hardenhelp.api.deps import get_store

router = APIRouter()


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/ready")
def ready(request: Request, response: Response) -> dict[str, object]:
    store = get_store(request)
    loaded = bool(store.records)
    enough_records = len(store.records) >= 20
    if not loaded or not enough_records:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return {
        "status": "ready" if loaded and enough_records else "not_ready",
        "checks": {
            "records_loaded": loaded,
            "minimum_records": enough_records,
        },
        "records_count": len(store.records),
    }
