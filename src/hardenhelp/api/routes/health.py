"""Liveness and readiness endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, Response, status

from hardenhelp.api.deps import check_db

router = APIRouter()


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/ready")
async def ready(
    response: Response,
    database_up: Annotated[bool, Depends(check_db)],
) -> dict[str, object]:
    if not database_up:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return {
        "status": "ready" if database_up else "not_ready",
        "checks": {"database": database_up},
    }
