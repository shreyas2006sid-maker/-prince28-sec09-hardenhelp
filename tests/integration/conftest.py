"""Integration tests use a fresh PostgreSQL database for each test run."""

import asyncio
import os
import uuid
from collections.abc import Iterator

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import create_async_engine

from hardenhelp.config import get_settings
from hardenhelp.db.url import to_asyncpg_url

BASE_URL = os.getenv("TEST_DATABASE_URL")


def pytest_collection_modifyitems(config: pytest.Config, items: list[pytest.Item]) -> None:
    if BASE_URL:
        return
    skip = pytest.mark.skip(reason="set TEST_DATABASE_URL to run integration tests")
    for item in items:
        if "integration" in item.nodeid:
            item.add_marker(skip)


async def _admin(sql: str) -> None:
    if BASE_URL is None:
        raise RuntimeError("TEST_DATABASE_URL is required to manage the integration database")
    admin_url = make_url(to_asyncpg_url(BASE_URL)).set(database="postgres")
    engine = create_async_engine(admin_url, isolation_level="AUTOCOMMIT")
    try:
        async with engine.connect() as connection:
            await connection.execute(text(sql))
    finally:
        await engine.dispose()


@pytest.fixture(scope="session")
def database_url() -> Iterator[str]:
    if BASE_URL is None:
        pytest.skip("set TEST_DATABASE_URL to run integration tests")

    database_name = f"test_{uuid.uuid4().hex[:12]}"
    database_url = make_url(to_asyncpg_url(BASE_URL)).set(database=database_name)
    database_url_string = database_url.render_as_string(hide_password=False)
    monkeypatch = pytest.MonkeyPatch()
    created = False

    try:
        asyncio.run(_admin(f'CREATE DATABASE "{database_name}"'))
        created = True
        monkeypatch.setenv("APP_ENV", "ci")
        monkeypatch.setenv("DATABASE_URL", database_url_string)
        get_settings.cache_clear()
        command.upgrade(Config("alembic.ini"), "head")
        yield database_url_string
    finally:
        get_settings.cache_clear()
        monkeypatch.undo()
        get_settings.cache_clear()
        if created:
            asyncio.run(_admin(f'DROP DATABASE IF EXISTS "{database_name}" WITH (FORCE)'))
