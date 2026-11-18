import pytest
from fastapi.testclient import TestClient

from hardenhelp.api.deps import check_db, get_repo
from hardenhelp.api.main import create_app
from hardenhelp.config import Settings

SAMPLE = [
    {"id": "001", "title": "Alpha guideline", "year": 2023, "kind": "guideline"},
    {"id": "002", "title": "Beta circular", "year": 2024, "kind": "circular"},
    {"id": "003", "title": "Gamma notice", "year": 2025, "kind": "circular"},
]


class FakeRepo:
    def __init__(self, rows: list[dict[str, object]]) -> None:
        self.rows = rows

    async def list(
        self, *, q: str | None, filters: dict[str, str], limit: int, offset: int
    ) -> tuple[int, list[dict[str, object]]]:
        rows = [
            row
            for row in self.rows
            if (not q or q.casefold() in str(row).casefold())
            and all(str(row.get(key)) == value for key, value in filters.items())
        ]
        return len(rows), rows[offset : offset + limit]

    async def get(self, external_id: str) -> dict[str, object] | None:
        return next((row for row in self.rows if row["id"] == external_id), None)

    async def stats(self) -> dict[str, object]:
        counts: dict[str, int] = {}
        for row in self.rows:
            severity = str(row.get("severity") or "unknown")
            counts[severity] = counts.get(severity, 0) + 1
        return {"record_count": len(self.rows), "severity_counts": counts}


@pytest.fixture
def settings() -> Settings:
    return Settings(
        app_env="ci",
        database_url="postgresql://localhost:5432/unused",
        _env_file=None,
    )


@pytest.fixture
def db_state() -> dict[str, bool]:
    return {"up": True}


@pytest.fixture
def client(settings: Settings, db_state: dict[str, bool]) -> TestClient:
    app = create_app(settings)
    app.dependency_overrides[get_repo] = lambda: FakeRepo(SAMPLE)
    app.dependency_overrides[check_db] = lambda: db_state["up"]
    with TestClient(app) as test_client:
        yield test_client
