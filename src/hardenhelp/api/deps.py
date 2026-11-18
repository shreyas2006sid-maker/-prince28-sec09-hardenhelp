"""FastAPI dependencies."""

from fastapi import Request

from hardenhelp.store import RecordStore


def get_store(request: Request) -> RecordStore:
    return request.app.state.store
