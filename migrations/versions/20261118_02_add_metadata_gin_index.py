"""add GIN index on document metadata

Revision ID: d03_002
Revises: d03_001
Create Date: 2026-11-18
"""

from typing import Sequence, Union

from alembic import op

revision: str = "d03_002"
down_revision: Union[str, None] = "d03_001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "ix_documents_metadata_gin",
        "documents",
        ["metadata"],
        unique=False,
        postgresql_using="gin",
        postgresql_ops={"metadata": "jsonb_path_ops"},
    )


def downgrade() -> None:
    op.drop_index("ix_documents_metadata_gin", table_name="documents")
