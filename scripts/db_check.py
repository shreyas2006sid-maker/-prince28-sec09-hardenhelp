"""Verify the configured PostgreSQL connection.

Run: uv run python scripts/db_check.py
"""

import asyncio

from sqlalchemy import text

from hardenhelp.config import get_settings
from hardenhelp.db.session import make_engine


async def main() -> None:
    engine = make_engine(get_settings())
    try:
        async with engine.connect() as connection:
            database, version = (
                await connection.execute(text("SELECT current_database(), version()"))
            ).one()
        print(f"Connected to database {database!r}")
        print(version)
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
