"""Create versioned project documents and a derived PostGIS boundary index."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB
revision = '0001'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    postgres = op.get_bind().dialect.name == 'postgresql'
    if postgres: op.execute('CREATE EXTENSION IF NOT EXISTS postgis')
    op.create_table('projects', sa.Column('id', sa.String(36), primary_key=True), sa.Column('revision', sa.Integer(), nullable=False), sa.Column('document', JSONB() if postgres else sa.JSON(), nullable=False))
    # Structured source geometry is in local NZTM metres. A geographic boundary
    # index can be populated by later GIS imports; no fake spatial values are stored.
    if postgres:
        op.execute('ALTER TABLE projects ADD COLUMN boundary geometry(Polygon, 2193)')
        op.execute('CREATE INDEX ix_projects_boundary ON projects USING GIST(boundary)')

def downgrade(): op.drop_table('projects')
