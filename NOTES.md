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

---

## D04 · Docker, Compose and tests

### The image

```text
> docker images hardenhelp:dev
IMAGE            ID             DISK USAGE   CONTENT SIZE   EXTRA
hardenhelp:dev   db285fab292c        300MB           70MB

> docker run --rm hardenhelp:dev id
uid=999(app) gid=999(app) groups=999(app)
```

- Size: 300 MB (under the 400 MB target).
- A measured validation build took 48.57 seconds with cache. The first cold-build time and a
  rebuild after changing one line were not captured.
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

The unit count is 18 in this checkout. The untested request-failure loggingpath is not covered by the current tests.

---

## D05 · CI/CD, Render deployment and rollback

### Production deployment

- Production URL: https://hardenhelp.onrender.com
- API documentation: https://hardenhelp.onrender.com/docs
- Health endpoint: https://hardenhelp.onrender.com/health
- Readiness endpoint: https://hardenhelp.onrender.com/ready
- Hosting: Render
- Database: Neon PostgreSQL
- Container registry: GitHub Container Registry (GHCR)

### CI pipeline

GitHub Actions runs CI for pull requests and pushes to `main`.

The pipeline includes:
- Linting and formatting checks.
- Tests and coverage checks.
- Docker image build.
- Image publishing to GHCR after successful CI on `main`.

### CD pipeline

The CD workflow runs after successful CI on `main`.

Deployment process:

1. Check out the requested commit.
2. Install project dependencies.
3. Run production database migrations for automatic deployments.
4. Trigger the Render deployment using the matching GHCR image.
5. Run production smoke tests.

The smoke test checks:
- `/health`
- `/ready`
- `/v1/documents?limit=1`
- The deployed Git commit SHA.

### Health and readiness checks

The `/health` endpoint supports GET and HEAD requests.

The `/ready` endpoint checks database availability.

- `/health` returns HTTP 200 when the application is running.
- `/ready` returns HTTP 200 when the database is available.
- `/ready` returns HTTP 503 when the database is unavailable.

### Uptime monitoring

- UptimeRobot monitors `https://hardenhelp.onrender.com/health`.
- Monitoring interval: 5 minutes.
- The monitor was verified as UP after adding HEAD support to the health endpoint.

### Rollback drill

Previous stable commit:

`3152a2675d457c01e0fb3d433abfe58594d4c3b9`

Rollback was performed using the manual CD workflow dispatch with the selected commit SHA.

The production health endpoint reported the rollback version, and all smoke tests passed.

After the rollback test, the application was deployed forward again to:

`aa36240651d264908fd9228a50bb4783debf5635`

The latest production smoke test passed:

```text
PASS: deployed version - aa36240651d264908fd9228a50bb4783debf5635
PASS: /health - HTTP 200
PASS: /ready - HTTP 200
PASS: /v1/documents?limit=1 - HTTP 200

All smoke tests passed!
```

### Main branch protection

- Main branch protection ruleset: `protect-main`.
- Pull requests are used to merge changes into `main`.
- CI checks must pass before merging.

### Deployment observations

- Production deployment and smoke tests were verified.
- The rollback and subsequent roll-forward were both verified.
- Cold-start latency and first-request latency were not measured.
