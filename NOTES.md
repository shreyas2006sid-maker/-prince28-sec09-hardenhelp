# Engineering notes: HardenHelp

## D03 · PostgreSQL

### Migrations (upgrade, downgrade, upgrade)

```text
uv run alembic downgrade -1
uv run alembic current
uv run alembic upgrade head
uv run alembic history
```

```text
Running upgrade  -> d03_001, create documents and pages
Running upgrade d03_001 -> d03_002, add GIN index on document metadata
Running downgrade d03_002 -> d03_001, add GIN index on document metadata
Current revision: d03_001
Running upgrade d03_001 -> d03_002, add GIN index on document metadata
d03_001 -> d03_002 (head), add GIN index on document metadata
<base> -> d03_001, create documents and pages
```

### The loader is idempotent

```text
run 1: records=20 inserted=20 updated=0 unchanged=0
run 2: records=20 inserted=0 updated=0 unchanged=20
run 3 (after editing one record): records=20 inserted=0 updated=1 unchanged=19
```

### EXPLAIN for `?ssg_rule=sshd_disable_root_login`

```text
uv run python scripts/explain.py ssg_rule sshd_disable_root_login
```

```text
-- 1) What the planner chooses on its own:
Seq Scan on documents (cost=0.00..11.00 rows=1 width=36)
Filter: (metadata @> '{"ssg_rule": "sshd_disable_root_login"}'::jsonb)
Rows Removed by Filter: 19

-- 2) Seq scan switched off, to prove the index can be used:
Bitmap Heap Scan on documents
Recheck Cond: (metadata @> '{"ssg_rule": "sshd_disable_root_login"}'::jsonb)
-> Bitmap Index Scan on ix_documents_metadata_gin
Index Cond: (metadata @> '{"ssg_rule": "sshd_disable_root_login"}'::jsonb)
```

Why did the planner choose a Seq Scan on my table? (2 lines, your own words)

Why: with only 20 sample rows, PostgreSQL estimates that reading the small table directly costs less
than jumping back and forth between a GIN index and heap pages.

When would it switch to the GIN index? (1 line)

When the table is large enough that index filtering returns a small fraction of the rows and is
cheaper than a sequential scan.

## D04 · Docker, Compose and tests

### The image

```text
hardenhelp:dev sha256:db285fab292c3b8867b3e9789d1b30d2853fcb7c64f58d9685a7cf0896c531ab 300MB
uid=999(app) gid=999(app) groups=999(app)
```

- Size: 300 MB (under the 400 MB target).
- This validation build took 48.57 seconds; it was cache-assisted, so the first cold build time was
  not measured.
- BuildKit reused the unchanged uv-copy and workdir layers; it rebuilt the dependency stage after
  `uv.lock` changed.

### The stack

```text
api       Up (healthy)       0.0.0.0:8000->8000/tcp
db        Up (healthy)       0.0.0.0:5433->5432/tcp
migrate   Exited (0)
redis     Up (healthy)       0.0.0.0:6379->6379/tcp

INFO  [alembic.runtime.migration] Context impl PostgresqlImpl.
INFO  [alembic.runtime.migration] Will assume transactional DDL.
records=20 inserted=0 updated=0 unchanged=20
```

### Breaking the database on purpose

```text
db stopped:  /health -> {"status":"ok"}                                      HTTP 200
db stopped:  /ready  -> {"status":"not_ready","checks":{"database":false}}  HTTP 503
db started:  /ready  -> {"status":"ready","checks":{"database":true}}       HTTP 200
```

The load balancer should stop routing to an unready API, but the process is alive and recovers when
Postgres returns, so restarting the app is unnecessary.

### Tests and coverage

```text
uv run poe test              -> 18 passed
uv run poe test-integration  -> 7 passed
uv run poe cov               -> 18 passed, 7 skipped; TOTAL 84%
with TEST_DATABASE_URL set   -> 25 passed; TOTAL 95%
```

The unit count is 18 in this checkout. The untested request-failure logging path in
`src/hardenhelp/api/middleware.py` (lines 19-30) is worth covering for observability. The database
stats query in `src/hardenhelp/db/repository.py` (lines 77-81) also needs a real-Postgres test.

### Fresh-volume Compose check

```text
new project: hardenhelp-clean-check
db and redis: healthy
migrate: Exited (0), records=20 inserted=20 updated=0 unchanged=0
/ready: {"status":"ready","checks":{"database":true}}
```

The temporary project and its volume were removed afterward; the existing `hardenhelp_pgdata`
volume was preserved and the original stack was restored healthy. A literal Git clean-clone check
is still pending because these changes have not been committed. The standalone Docker build used a
307.68 kB context with `.dockerignore` in effect.
