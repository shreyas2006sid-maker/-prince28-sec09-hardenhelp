import os

import pytest
from fastapi.testclient import TestClient

from hardenhelp.api.main import create_app
from hardenhelp.config import Settings

TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(
    not TEST_DATABASE_URL,
    reason="set TEST_DATABASE_URL to a dedicated Postgres test database",
)


@pytest.fixture
def database_client() -> TestClient:
    if not TEST_DATABASE_URL:
        pytest.skip("TEST_DATABASE_URL is not configured")
    settings = Settings(
        app_env="ci",
        database_url=TEST_DATABASE_URL,
        _env_file=None,
    )
    with TestClient(create_app(settings)) as client:
        yield client


def test_database_readiness(database_client: TestClient) -> None:
    response = database_client.get("/ready")
    assert response.status_code == 200
    assert response.json()["checks"]["database"] is True


def test_documents_list_uses_postgres(database_client: TestClient) -> None:
    response = database_client.get("/v1/documents", params={"limit": 5})
    assert response.status_code == 200
    assert isinstance(response.json()["total"], int)
    assert len(response.json()["items"]) <= 5


def test_metadata_filter_uses_postgres(database_client: TestClient) -> None:
    response = database_client.get(
        "/v1/documents",
        params={"ssg_rule": "sshd_disable_root_login"},
    )
    assert response.status_code == 200
    assert response.json()["filters"] == {"ssg_rule": "sshd_disable_root_login"}
