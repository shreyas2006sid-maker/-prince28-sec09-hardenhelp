"""Show PostgreSQL's query plan for a JSONB metadata filter.

Run: uv run python scripts/explain.py <field> <value>
"""

import asyncio
import json
import sys

from sqlalchemy import text

from hardenhelp.config import get_settings
from hardenhelp.db.session import make_engine

SQL = "EXPLAIN ANALYZE SELECT id, title FROM documents WHERE metadata @> CAST(:filter AS jsonb)"


async def main(field: str, value: str) -> None:
    engine = make_engine(get_settings())
    params = {"filter": json.dumps({field: value})}
    try:
        async with engine.begin() as connection:
            print("-- 1) What the planner chooses on its own:")
            for line in (await connection.execute(text(SQL), params)).scalars():
                print(line)

            await connection.execute(text("SET LOCAL enable_seqscan = off"))
            print("\n-- 2) Seq scan switched off, to prove the index can be used:")
            for line in (await connection.execute(text(SQL), params)).scalars():
                print(line)
    finally:
        await engine.dispose()


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit("usage: uv run python scripts/explain.py <field> <value>")
    asyncio.run(main(sys.argv[1], sys.argv[2]))
