"""MINOS account login -> private Pi Web server-to-server bridge."""
from fastapi import APIRouter, Body, Depends
from fastapi.responses import Response
from pydantic import BaseModel, Field, model_validator
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.user import User
from app.routers_fe.utils import get_fe_user
from app.services.pi_web_service import manager

router = APIRouter(prefix='/pi-web', tags=['FE-Pi Web'])


class BridgeCredentials(BaseModel):
    bridgeSecret: str = Field(min_length=1, max_length=512)
    token: str | None = Field(default=None, min_length=1, max_length=512)
    ticket: str | None = Field(default=None, min_length=1, max_length=512)

    @model_validator(mode='after')
    def one_credential(self):
        if bool(self.token) == bool(self.ticket):
            raise ValueError('Provide exactly one of ticket or token')
        return self


class ToolRequest(BaseModel):
    bridgeSecret: str = Field(min_length=1, max_length=512)
    token: str = Field(min_length=1, max_length=512)
    piSessionId: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=80)
    arguments: dict = Field(default_factory=dict)


class PdfRequest(BaseModel):
    bridgeSecret: str = Field(min_length=1, max_length=512)
    token: str = Field(min_length=1, max_length=512)
    piSessionId: str = Field(min_length=1, max_length=64)
    revision: int = Field(ge=0)


class DocumentRequest(BaseModel):
    bridgeSecret: str = Field(min_length=1, max_length=512)
    token: str = Field(min_length=1, max_length=512)
    path: str = Field(min_length=1, max_length=4096)


class LaunchRequest(BaseModel):
    acknowledgeLocalAgent: bool = False


@router.get('/launch')
def launch(user: User = Depends(get_fe_user)):
    return manager.launch(user.id)


@router.post('/launch')
def launch_confirm(req: LaunchRequest = Body(default=LaunchRequest()), user: User = Depends(get_fe_user)):
    return manager.launch(user.id, acknowledge_local_agent=req.acknowledgeLocalAgent)


@router.post('/verify')
def verify(req: BridgeCredentials, db: Session = Depends(get_db)):
    return manager.verify(db, bridge_secret=req.bridgeSecret, ticket=req.ticket, token=req.token)


@router.post('/document-read')
def document_read(req: DocumentRequest, db: Session = Depends(get_db)):
    from app.services.workspace_documents import read_workspace_document
    identity = manager.verify(db, token=req.token, bridge_secret=req.bridgeSecret)
    return read_workspace_document(identity['workspace'], req.path)


@router.post('/resume-tool')
def resume_tool(req: ToolRequest, db: Session = Depends(get_db)):
    return manager.resume_tool(db, token=req.token, bridge_secret=req.bridgeSecret,
                               pi_session_id=req.piSessionId, name=req.name, arguments=req.arguments)


@router.post('/resume-pdf')
def resume_pdf(req: PdfRequest, db: Session = Depends(get_db)):
    return Response(manager.resume_pdf(db, token=req.token, bridge_secret=req.bridgeSecret,
                    pi_session_id=req.piSessionId, revision=req.revision), media_type='application/pdf',
                    headers={'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'})


@router.post('/stop')
def stop(user: User = Depends(get_fe_user)):
    return manager.stop(user.id)
