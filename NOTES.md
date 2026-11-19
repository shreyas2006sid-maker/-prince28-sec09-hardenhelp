# Engineering notes: HardenHelp

## D03 · PostgreSQL

### Migrations (upgrade, downgrade, upgrade)

```text
uv run alembic downgrade -1
uv run alembic current
uv run alembic upgrade head
uv run alembic history
```

The repository contains two Alembic migrations:

```text
d03_001 -> create documents and pages
d03_002 -> add the GIN index on documents.metadata
```

Live Neon migration output could not be recorded until this machine's `DATABASE_URL` is replaced
with a working Neon connection string. The configured local connection is not a running PostgreSQL
database in this environment.

### The loader is idempotent

```text
run 1: uv run python scripts/load_db.py
run 2: uv run python scripts/load_db.py
run 3 (after editing one record): uv run python scripts/load_db.py
```

The loader compares SHA-256 fingerprints and has separate inserted, updated, and unchanged counters.
Run the three commands against the configured database to replace the placeholders above with actual
runtime output.

### EXPLAIN for `?ssg_rule=sshd_disable_root_login`

```text
uv run python scripts/explain.py ssg_rule sshd_disable_root_login
```

Live query-plan output could not be captured until the Neon connection is available. The SQL used by
the script uses `metadata @> CAST(:filter AS jsonb)` and can use
`ix_documents_metadata_gin` for larger JSONB tables.

Why did the planner choose a Seq Scan on my table? (2 lines, your own words)

Why: with only 20 sample rows, PostgreSQL estimates that reading the small table directly costs less
than jumping back and forth between a GIN index and heap pages.

When would it switch to the GIN index? (1 line)

When the table is large enough that index filtering returns a small fraction of the rows and is
cheaper than a sequential scan.
