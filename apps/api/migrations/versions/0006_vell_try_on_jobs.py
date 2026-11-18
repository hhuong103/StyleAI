"""Durable VELL try-on jobs."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade():
    json_type = sa.JSON().with_variant(JSONB(), "postgresql")
    op.create_table(
        "vell_try_on_jobs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("idempotency_key", sa.String(36), nullable=False),
        sa.Column("request_hash", sa.String(64), nullable=False),
        sa.Column("provider", sa.String(40), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("payload", json_type, nullable=False),
        sa.Column("result", json_type, nullable=True),
        sa.Column("error", json_type, nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True)),
        sa.Column("finished_at", sa.DateTime(timezone=True)),
        sa.Column("lease_expires_at", sa.DateTime(timezone=True)),
        sa.Column("worker_token", sa.String(36)),
        sa.UniqueConstraint("user_id", "idempotency_key", name="uq_vell_job_idempotency"),
        sa.CheckConstraint(
            "status IN ('QUEUED','RUNNING','SUCCEEDED','FAILED','CANCELLED')",
            name="ck_vell_job_status",
        ),
        sa.CheckConstraint(
            "status != 'SUCCEEDED' OR result IS NOT NULL", name="ck_vell_job_result"
        ),
    )
    op.create_index("ix_vell_try_on_jobs_user_id", "vell_try_on_jobs", ["user_id"])
    op.create_index("ix_vell_job_queue", "vell_try_on_jobs", ["status", "created_at"])


def downgrade():
    op.drop_table("vell_try_on_jobs")
