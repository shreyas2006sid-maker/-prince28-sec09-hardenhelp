# HardenHelp

HardenHelp explains Linux and Windows hardening rules from the DISA STIGs and the SCAP Security
Guide: what a rule checks, why it matters and the exact fix for the right OS version.

**Status:** Day 3 foundation (PostgreSQL, migrations, idempotent loader, FastAPI API).

## Who it's for

Junior system administrator at a Chennai fintech who must harden 30 Ubuntu 22.04 servers before a
client security audit.

## The problem

STIG and SCAP requirements use overlapping but inconsistent identifiers across releases and OS
families. Administrators must map a STIG ID, SV-ID, CCI or SSG rule name to the same requirement
before applying a remediation. Security fixes can also change authentication or network behavior,
so a blind change may disconnect a server or lock out administrators. HardenHelp keeps rule metadata
and remediation commands together to support accurate, reviewed deployments.

## Data sources

- DISA STIG downloads: https://public.cyber.mil/stigs/downloads/
- ComplianceAsCode: https://github.com/ComplianceAsCode/content
- NIST NCP: https://ncp.nist.gov/repository
- OpenSCAP: https://www.open-scap.org/

## Hardest problem

The same requirement has several IDs and those IDs can change between OS releases. Exact-ID lookup
must map identifiers consistently and always show the OS match and lock-out risk before a fix is
applied.

## Signature feature

Rule card: enter a STIG, SV, CCI or SSG ID and see the mapped requirement, severity, check command,
fix command and lock-out-risk badge.

## Target metric

ID mapping correct for 100% of 50 cross-ID lookups; check and fix commands correct for at least 90%
of 40 rules on a test VM.

## Run locally

```bash
uv sync
copy .env.example .env
# Set DATABASE_URL in .env to your Neon PostgreSQL connection string.
uv run alembic upgrade head
uv run python scripts/load_db.py
uv run uvicorn hardenhelp.api.main:create_app --factory --reload --no-access-log
```

Open http://localhost:8000/docs.

The service starts even if Postgres is unreachable: `/health` remains a liveness check and
`/ready` returns HTTP 503 until the database responds. Do not commit `.env`; `DATABASE_URL`
contains database credentials.

## Database workflow

```bash
uv run alembic upgrade head
uv run alembic downgrade -1
uv run alembic upgrade head
uv run python scripts/load_db.py
uv run python scripts/load_db.py
uv run python scripts/explain.py ssg_rule sshd_disable_root_login
```

The loader uses a SHA-256 fingerprint: repeated runs skip unchanged rows and update changed rows.
The seed data is for development and learning; verify each rule's OS applicability and remediation
against its upstream source before using it for an audit.

Optional integration tests require a dedicated database with migrations applied:

```powershell
$env:TEST_DATABASE_URL = "postgresql://..."
uv run pytest tests/test_db_integration.py
```

## Checks

```bash
uv run pytest
uv run ruff check .
uv run pre-commit run --all-files
```
