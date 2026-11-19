"""Normalize Postgres connection URLs for SQLAlchemy's asyncpg driver."""

from sqlalchemy.engine import make_url

SYNC_DRIVERS = {"postgres", "postgresql", "postgresql+psycopg", "postgresql+psycopg2"}


def to_asyncpg_url(raw: str) -> str:
    url = make_url(raw)
    if url.drivername in SYNC_DRIVERS:
        url = url.set(drivername="postgresql+asyncpg")
    elif url.drivername != "postgresql+asyncpg":
        raise ValueError("DATABASE_URL must use a PostgreSQL scheme")

    query = dict(url.query)
    sslmode = query.pop("sslmode", None)
    query.pop("channel_binding", None)
    if sslmode and sslmode != "disable":
        query["ssl"] = "require"
    elif sslmode == "disable":
        query["ssl"] = "disable"
    return url.set(query=query).render_as_string(hide_password=False)
