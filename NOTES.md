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
