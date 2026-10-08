import os
import tempfile
from uuid import uuid4
os.environ['DATABASE_URL'] = 'sqlite:///' + tempfile.mktemp(suffix='.db').replace('\\', '/')
from fastapi.testclient import TestClient
from app.database import Base, engine
from app.main import app
from app.models import Project
from pyproj import Transformer
from pydantic import ValidationError
import pytest
Base.metadata.create_all(engine)
client = TestClient(app)

def project():
    return dict(schemaVersion=1, id=str(uuid4()),name='Integration test',revision=0,scenarioId=str(uuid4()),scenarioName='Base',origin=[172.6362,-43.5321],horizontalCRS='EPSG:2193',verticalReference='Conceptual offset above ellipsoid; not NZVD2016',objects=[])

def test_save_restore_and_optimistic_conflict():
    p=project()
    r=client.put(f"/api/projects/{p['id']}",json=p)
    assert r.status_code==200, r.text
    saved=r.json()
    assert saved['revision']==1
    assert client.get(f"/api/projects/{p['id']}").json()==saved
    assert client.put(f"/api/projects/{p['id']}",json=p).status_code==409
    assert client.put(f"/api/projects/{p['id']}",json=saved).json()['revision']==2

def test_invalid_coordinate_origin_and_path():
    p=project();p['origin']=[0,0]
    assert client.put(f"/api/projects/{p['id']}",json=p).status_code==422
    p=project()
    assert client.put(f'/api/projects/{uuid4()}',json=p).status_code==422

def test_projection_roundtrip():
    forward=Transformer.from_crs(4326,2193,always_xy=True)
    reverse=Transformer.from_crs(2193,4326,always_xy=True)
    x,y=forward.transform(172.6362,-43.5321)
    lon,lat=reverse.transform(x,y)
    assert abs(lon-172.6362)<1e-9 and abs(lat+43.5321)<1e-9

def test_invalid_asset_key():
    from app.storage import safe_key
    with pytest.raises(ValueError): safe_key('../private.glb')
