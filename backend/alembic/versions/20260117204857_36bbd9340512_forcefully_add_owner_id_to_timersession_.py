"""Forcefully add owner_id to timersession and projectwatchlist via rebuild

Revision ID: 36bbd9340512
Revises: 3fed1669a7c1
Create Date: 2026-01-17 20:48:57.191357

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '36bbd9340512'
down_revision: Union[str, Sequence[str], None] = '3fed1669a7c1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    
    # Cleanup residue from previous failed batch operations
    op.execute("DROP TABLE IF EXISTS _alembic_tmp_projectwatchlist")
    op.execute("DROP TABLE IF EXISTS _alembic_tmp_timersession")
    op.execute("DROP TABLE IF EXISTS _alembic_tmp_trackedtask")

    # Explicitly drop indexes that might exist from failed previous runs
    op.execute("DROP INDEX IF EXISTS ix_projectwatchlist_owner_id")
    op.execute("DROP INDEX IF EXISTS ix_timersession_owner_id")
    op.execute("DROP INDEX IF EXISTS ix_trackedtask_owner_id")

    # Forcefully apply batch operations to ensure schema sync
    with op.batch_alter_table('projectwatchlist', schema=None) as batch_op:
        # No check for column, force add (Batch mode handles rebuild)
        batch_op.add_column(sa.Column('owner_id', sa.Integer(), nullable=False, server_default='1'))
        batch_op.create_index(op.f('ix_projectwatchlist_owner_id'), ['owner_id'], unique=False)
        batch_op.create_foreign_key('fk_projectwatchlist_owner', 'user', ['owner_id'], ['id'])

    with op.batch_alter_table('timersession', schema=None) as batch_op:
        batch_op.add_column(sa.Column('owner_id', sa.Integer(), nullable=False, server_default='1'))
        batch_op.create_index(op.f('ix_timersession_owner_id'), ['owner_id'], unique=False)
        batch_op.create_foreign_key('fk_timersession_owner', 'user', ['owner_id'], ['id'])

    # TrackedTask seems to have owner_id already in some environments, check first
    from sqlalchemy import inspect
    inspector = inspect(bind)
    tracked_cols = [c['name'] for c in inspector.get_columns('trackedtask')]
    
    with op.batch_alter_table('trackedtask', schema=None) as batch_op:
        if 'owner_id' not in tracked_cols:
            batch_op.add_column(sa.Column('owner_id', sa.Integer(), nullable=False, server_default='1'))
            batch_op.create_foreign_key('fk_trackedtask_owner', 'user', ['owner_id'], ['id'])
        
        # Always recreate the index since we dropped it above
        batch_op.create_index(op.f('ix_trackedtask_owner_id'), ['owner_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    pass
