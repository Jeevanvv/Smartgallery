"""Initial schema

Revision ID: 001
Revises:
Create Date: 2026-06-07

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        "photographers",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("supabase_user_id", sa.UUID(), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("google_oauth_token", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.create_index("ix_photographers_email", "photographers", ["email"])
    op.create_index("ix_photographers_supabase_user_id", "photographers", ["supabase_user_id"])
    op.create_unique_constraint(
        "uq_photographers_supabase_user_id", "photographers", ["supabase_user_id"]
    )

    op.create_table(
        "events",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("photographer_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("slug", sa.String(length=100), nullable=False),
        sa.Column("drive_folder_id", sa.String(length=255), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["photographer_id"], ["photographers.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
    )
    op.create_index("ix_events_photographer_id", "events", ["photographer_id"])
    op.create_index("ix_events_slug", "events", ["slug"])

    op.create_table(
        "photos",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("event_id", sa.UUID(), nullable=False),
        sa.Column("drive_file_id", sa.String(length=255), nullable=False),
        sa.Column("drive_url", sa.Text(), nullable=True),
        sa.Column("thumbnail_url", sa.Text(), nullable=True),
        sa.Column("filename", sa.String(length=512), nullable=False),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("processing_status", sa.String(length=50), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["event_id"], ["events.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("drive_file_id"),
    )
    op.create_index("ix_photos_event_id", "photos", ["event_id"])
    op.create_index("ix_photos_drive_file_id", "photos", ["drive_file_id"])

    op.create_table(
        "face_embeddings",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("photo_id", sa.UUID(), nullable=False),
        sa.Column("embedding", Vector(512), nullable=False),
        sa.Column("face_box", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["photo_id"], ["photos.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_face_embeddings_photo_id", "face_embeddings", ["photo_id"])

    op.create_table(
        "search_sessions",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("event_id", sa.UUID(), nullable=False),
        sa.Column("match_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("searched_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["event_id"], ["events.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_search_sessions_event_id", "search_sessions", ["event_id"])


def downgrade() -> None:
    op.drop_table("search_sessions")
    op.drop_table("face_embeddings")
    op.drop_table("photos")
    op.drop_table("events")
    op.drop_table("photographers")
