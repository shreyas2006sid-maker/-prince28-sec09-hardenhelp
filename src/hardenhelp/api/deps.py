"""Database dependencies for FastAPI requests."""

import logging
from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from hardenhelp.db.repository import DocumentRepository


async def get_session(request: Request) -> AsyncIterator[AsyncSession]:
    session_factory = request.app.state.session_factory
    async with session_factory() as session:
        yield session


SessionDependency = Annotated[AsyncSession, Depends(get_session)]


def get_repo(session: SessionDependency) -> DocumentRepository:
    return DocumentRepository(session)


async def check_db(request: Request) -> bool:
    try:
        async with request.app.state.engine.connect() as connection:
            result = await connection.execute(text("SELECT COUNT(*) FROM documents"))
            record_count = result.scalar_one()

        return record_count >= 20

    except (OSError, SQLAlchemyError):
        logging.warning(
            "database readiness check failed",
            extra={"database": False},
        )
        return False
