"""Add guest details to search sessions

Revision ID: 003
Revises: 002
Create Date: 2026-06-24

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("search_sessions", sa.Column("guest_name", sa.String(length=255), nullable=True))
    op.add_column("search_sessions", sa.Column("guest_phone", sa.String(length=50), nullable=True))
    op.add_column("search_sessions", sa.Column("guest_email", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("search_sessions", "guest_email")
    op.drop_column("search_sessions", "guest_phone")
    op.drop_column("search_sessions", "guest_name")