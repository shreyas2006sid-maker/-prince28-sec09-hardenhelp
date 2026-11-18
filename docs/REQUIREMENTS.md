# Requirements

## Functional requirements

1. The service must expose `/health` and return HTTP 200 with status `ok`.
2. The service must expose `/ready` and fail with HTTP 503 when fewer than 20 records are loaded.
3. The service must return paginated document results with a limit between 1 and 100.
4. The service must support text search and exact `stig_id` filtering across records.
5. The service must return missing document IDs as RFC 9457 problem details with HTTP 404.

## Non-functional requirements

1. Every response must include a unique or echoed `X-Request-ID`.
2. Every request must produce structured JSON logging with request timing under the configured log level.
3. Invalid environment values must prevent startup with a clear Pydantic validation error.
4. Ruff must report zero lint violations and pytest must pass at least 10 tests.
5. Secrets and virtual environments must remain excluded from Git, and pre-commit must run secret and
   formatting checks on every commit.
