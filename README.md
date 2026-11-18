# HardenHelp

HardenHelp explains Linux and Windows hardening rules from the DISA STIGs and the SCAP Security
Guide: what a rule checks, why it matters and the exact fix for the right OS version.

**Status:** Day 1 foundation (FastAPI skeleton, quality gates).

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
cp .env.example .env
uv run uvicorn hardenhelp.api.main:create_app --factory --reload --no-access-log
```

Open http://localhost:8000/docs.

## Checks

```bash
uv run pytest
uv run ruff check .
uv run pre-commit run --all-files
```
