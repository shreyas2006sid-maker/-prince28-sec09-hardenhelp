import json

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from hardenhelp.api.main import create_app
from hardenhelp.config import Settings


def test_health_is_ok(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_ready_when_records_loaded(client):
    response = client.get("/ready")
    assert response.status_code == 503
    assert response.json()["checks"]["records_loaded"] is True


def test_ready_is_503_when_data_file_missing(tmp_path):
    settings = Settings(app_env="ci", data_file=tmp_path / "missing.json")
    with TestClient(create_app(settings)) as test_client:
        assert test_client.get("/health").status_code == 200
        assert test_client.get("/ready").status_code == 503


def test_list_documents_paginates(client):
    response = client.get("/v1/documents", params={"limit": 2})
    body = response.json()
    assert response.status_code == 200
    assert body["total"] == 3
    assert len(body["items"]) == 2


def test_search_filters_records(client):
    response = client.get("/v1/documents", params={"q": "beta"})
    assert [document["id"] for document in response.json()["items"]] == ["002"]


def test_get_document_found(client):
    response = client.get("/v1/documents/001")
    assert response.status_code == 200
    assert response.json()["title"] == "Alpha guideline"


def test_missing_document_is_problem_details(client):
    response = client.get("/v1/documents/999")
    assert response.status_code == 404
    assert response.headers["content-type"] == "application/problem+json"
    body = response.json()
    assert body["status"] == 404
    assert body["title"] == "Not Found"
    assert body["request_id"] == response.headers["X-Request-ID"]


def test_bad_limit_is_422_problem(client):
    response = client.get("/v1/documents", params={"limit": 0})
    assert response.status_code == 422
    assert response.json()["errors"][0]["field"] == "query.limit"


def test_request_id_is_echoed(client):
    response = client.get("/health", headers={"X-Request-ID": "abc123"})
    assert response.headers["X-Request-ID"] == "abc123"


def test_app_refuses_to_start_without_app_env(monkeypatch):
    monkeypatch.delenv("APP_ENV", raising=False)
    with pytest.raises(ValidationError):
        Settings(_env_file=None)


def test_stats_counts_severity(tmp_path):
    records = [
        {"id": "001", "title": "One", "severity": "high"},
        {"id": "002", "title": "Two", "severity": "high"},
        {"id": "003", "title": "Three", "severity": "medium"},
    ]
    path = tmp_path / "records.json"
    path.write_text(json.dumps(records), encoding="utf-8")
    settings = Settings(app_env="ci", data_file=path)
    with TestClient(create_app(settings)) as test_client:
        body = test_client.get("/v1/stats").json()
        assert body["record_count"] == 3
        assert body["severity_counts"] == {"high": 2, "medium": 1}
