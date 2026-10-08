from uuid import UUID
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, update, text
from sqlalchemy.exc import IntegrityError
from .database import Session, ProjectRow, engine
from .models import Project

app = FastAPI(title='Sitecraft local planning API', version='0.1.0')
app.add_middleware(CORSMiddleware, allow_origins=['http://127.0.0.1:5173', 'http://localhost:5173'], allow_methods=['GET','PUT'], allow_headers=['Content-Type'])

@app.middleware('http')
async def bound_request_size(request: Request, call_next):
    # Count streamed bytes too; do not rely on a client Content-Length header.
    if request.method == 'PUT':
        body = bytearray()
        async for chunk in request.stream():
            body.extend(chunk)
            if len(body) > 5_000_000:
                from fastapi.responses import JSONResponse
                return JSONResponse({'detail':'Project exceeds 5 MB'}, status_code=413)
        request._body = bytes(body)
    return await call_next(request)

@app.get('/api/health')
def health():
    with engine.connect() as c: c.execute(text('SELECT 1'))
    return {'status':'ok', 'database':engine.dialect.name, 'authentication':'local-only; not configured'}

@app.get('/api/projects', response_model=list[Project])
def list_projects():
    with Session() as db:
        return [r.document for r in db.scalars(select(ProjectRow).order_by(ProjectRow.id)).all()]

@app.get('/api/projects/{project_id}', response_model=Project)
def get_project(project_id: UUID):
    with Session() as db:
        row = db.get(ProjectRow, str(project_id))
        if row is None: raise HTTPException(404, 'Project not found')
        return row.document

@app.put('/api/projects/{project_id}', response_model=Project)
def save_project(project_id: UUID, project: Project):
    if project_id != project.id: raise HTTPException(422, 'Project ID mismatch')
    document = project.model_dump(mode='json')
    document['revision'] += 1
    with Session() as db:
        row = db.get(ProjectRow, str(project_id))
        if row is None:
            if project.revision != 0: raise HTTPException(409, 'Project missing; import as a new project')
            db.add(ProjectRow(id=str(project_id), revision=1, document=document))
        else:
            result = db.execute(update(ProjectRow).where(ProjectRow.id == str(project_id), ProjectRow.revision == project.revision).values(revision=document['revision'], document=document))
            if result.rowcount != 1: raise HTTPException(409, 'Revision conflict; open the latest server project before saving')
        try: db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(409, 'Concurrent creation; reopen the project')
    return document
