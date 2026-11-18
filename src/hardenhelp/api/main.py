"""Application factory."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError

from hardenhelp.api.errors import problem_response, validation_exception_handler
from hardenhelp.api.middleware import RequestContextMiddleware
from hardenhelp.api.routes.documents import router as documents_router
from hardenhelp.api.routes.health import router as health_router
from hardenhelp.config import Settings
from hardenhelp.logging_setup import configure_logging
from hardenhelp.store import RecordStore


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()
    configure_logging(settings.log_level)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        store = RecordStore(settings.data_file)
        try:
            store.load()
            app.state.store = store
            logging.info(
                "records loaded",
                extra={
                    "records": len(store.records),
                    "data_file": str(settings.data_file),
                },
            )
        except RuntimeError as exc:
            app.state.store = RecordStore(settings.data_file)
            app.state.store.records = []
            logging.warning(str(exc), extra={"data_file": str(settings.data_file)})
        yield

    app = FastAPI(
        title=settings.app_name,
        lifespan=lifespan,
    )
    app.state.settings = settings
    app.add_middleware(RequestContextMiddleware)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)

    async def internal_server_error(request: Request, exc: Exception):
        return problem_response(
            request,
            500,
            "Internal Server Error",
            "An unexpected error occurred.",
        )

    app.add_exception_handler(Exception, internal_server_error)
    app.include_router(health_router)
    app.include_router(documents_router)
    return app
