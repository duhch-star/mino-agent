"""Authenticated persistent per-conversation resume and revision-specific PDF API."""
from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.user import User
from app.resume_schemas import DocumentUndo, DocumentWrite
from app.routers_fe.utils import get_fe_user
from app.services import resume_document_service as service

router = APIRouter(prefix='/resume/documents', tags=['FE-会话简历'])


@router.get('/{conversation_id}')
def read_document(conversation_id: str, db: Session = Depends(get_db), user: User = Depends(get_fe_user)):
    return service.read_document(db, user.id, conversation_id)


@router.put('/{conversation_id}')
def write_document(conversation_id: str, req: DocumentWrite, db: Session = Depends(get_db), user: User = Depends(get_fe_user)):
    return service.write_document(db, user.id, conversation_id, req.model_dump())


@router.get('/{conversation_id}/history')
def read_history(conversation_id: str, db: Session = Depends(get_db), user: User = Depends(get_fe_user)):
    return service.read_history(db, user.id, conversation_id)


@router.post('/{conversation_id}/undo')
def undo_document(conversation_id: str, req: DocumentUndo, db: Session = Depends(get_db), user: User = Depends(get_fe_user)):
    return service.undo_document(db, user.id, conversation_id, req.model_dump())


@router.post('/{conversation_id}/compile')
def compile_document(conversation_id: str, db: Session = Depends(get_db), user: User = Depends(get_fe_user)):
    return service.compile_document(db, user.id, conversation_id)


@router.get('/{conversation_id}/pdf')
def read_pdf(conversation_id: str, revision: int = Query(ge=0), db: Session = Depends(get_db), user: User = Depends(get_fe_user)):
    return Response(service.read_pdf(db, user.id, conversation_id, revision), media_type='application/pdf',
                    headers={'Content-Disposition': 'inline; filename="resume.pdf"', 'Cache-Control': 'no-store',
                             'X-Content-Type-Options': 'nosniff'})
