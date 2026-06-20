"""Allow archived events to reuse public slugs

Revision ID: 002
Revises: 001
Create Date: 2026-06-21

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint("events_slug_key", "events", type_="unique")
    op.create_index(
        "uq_events_active_slug",
        "events",
        ["slug"],
        unique=True,
        postgresql_where=sa.text("status = 'active'"),
    )


def downgrade() -> None:
    op.drop_index("uq_events_active_slug", table_name="events")
    op.create_unique_constraint("events_slug_key", "events", ["slug"])
