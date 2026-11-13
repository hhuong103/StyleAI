"""Store the exact Shopee listing for real products."""

import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("products", sa.Column("product_url", sa.Text(), nullable=True))


def downgrade():
    op.drop_column("products", "product_url")
