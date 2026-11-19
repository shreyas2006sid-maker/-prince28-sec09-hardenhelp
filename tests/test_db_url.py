import pytest
from sqlalchemy.engine import make_url

from hardenhelp.db.url import to_asyncpg_url


def test_neon_url_gets_asyncpg_driver_and_ssl() -> None:
    normalized = to_asyncpg_url(
        "postgresql://user:dummy1@host.example/neondb"  # pragma: allowlist secret
        "?sslmode=require&channel_binding=require"
    )
    url = make_url(normalized)
    assert url.drivername == "postgresql+asyncpg"
    assert url.password == "dummy1"  # pragma: allowlist secret
    assert url.query["ssl"] == "require"
    assert "channel_binding" not in url.query


def test_asyncpg_url_is_preserved() -> None:
    normalized = to_asyncpg_url("postgresql+asyncpg://user@localhost/db")
    assert make_url(normalized).drivername == "postgresql+asyncpg"


def test_non_postgres_url_is_rejected() -> None:
    with pytest.raises(ValueError, match="PostgreSQL"):
        to_asyncpg_url("sqlite:///hardenhelp.db")
