"""Ensure owner_id columns exist on all target tables

Revision ID: 3fed1669a7c1
Revises: 03fcfc6b044b
Create Date: 2026-01-17 20:48:30.936841

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3fed1669a7c1'
down_revision: Union[str, Sequence[str], None] = '03fcfc6b044b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    with op.batch_alter_table('projectwatchlist', schema=None) as batch_op:
        columns = [c['name'] for c in inspector.get_columns('projectwatchlist')]
        if 'owner_id' not in columns:
            batch_op.add_column(sa.Column('owner_id', sa.Integer(), nullable=False, server_default='1'))
            batch_op.create_index(op.f('ix_projectwatchlist_owner_id'), ['owner_id'], unique=False)
            batch_op.create_foreign_key('fk_projectwatchlist_owner', 'user', ['owner_id'], ['id'])

    with op.batch_alter_table('timersession', schema=None) as batch_op:
        columns = [c['name'] for c in inspector.get_columns('timersession')]
        if 'owner_id' not in columns:
            batch_op.add_column(sa.Column('owner_id', sa.Integer(), nullable=False, server_default='1'))
            batch_op.create_index(op.f('ix_timersession_owner_id'), ['owner_id'], unique=False)
            batch_op.create_foreign_key('fk_timersession_owner', 'user', ['owner_id'], ['id'])


def downgrade() -> None:
    """Downgrade schema."""
    pass
