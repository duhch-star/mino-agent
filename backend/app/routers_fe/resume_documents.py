"""Authenticated persistent per-conversation resume and revision-specific PDF API."""
from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session
from sqlalchemy import select
from uuid import UUID
import hashlib
import io

from app.core.responses import ApiException
from app.models.chat import ChatSession, ResumeDocument

from app.db.session import get_db
from app.models.user import User
from app.resume_schemas import DocumentUndo, DocumentWrite
from app.routers_fe.utils import get_fe_user
from app.services import resume_document_service as service

router = APIRouter(prefix='/resume/documents', tags=['FE-会话简历'])


def _pdf_ready(row):
    return bool(row and row.pdf_data and row.pdf_revision == row.revision)


@router.get('/current')
def current_preview(piSessionId: str | None = Query(default=None, max_length=64),
                    db: Session = Depends(get_db), user: User = Depends(get_fe_user)):
    """Read metadata only. Never creates a conversation, draft or compilation."""
    preferred = None
    if piSessionId:
        try:
            normalized = str(UUID(piSessionId))
        except ValueError:
            raise ApiException(40000, '会话标识不合法', status_code=400)
        preferred = 'conv_pi_' + hashlib.sha256((user.id + ':' + normalized).encode()).hexdigest()[:24]
    query = select(ResumeDocument).join(ChatSession, ChatSession.id == ResumeDocument.conversation_id).where(
        ResumeDocument.user_id == user.id, ChatSession.user_id == user.id)
    row = db.scalar(query.where(ResumeDocument.conversation_id == preferred)) if preferred else None
    if row is None:
        return {'exists': False, 'template': 'classic', 'pdfReady': False}
    return {'exists': True, 'conversationId': row.conversation_id, 'revision': row.revision,
            'template': row.template, 'pdfReady': _pdf_ready(row),
            'source': 'session' if row.conversation_id == preferred else 'recent'}


@router.get('/{conversation_id}/preview')
def preview_pdf(conversation_id: str, revision: int = Query(ge=0), page: int = Query(default=1, ge=1, le=100),
                db: Session = Depends(get_db), user: User = Depends(get_fe_user)):
    # Reuse the exact ownership/current-revision check used for downloading.
    data = service.read_pdf(db, user.id, conversation_id, revision)
    if len(data) > 20 * 1024 * 1024:
        raise ApiException(41300, 'PDF 过大，请下载查看', status_code=413)
    try:
        import pypdfium2 as pdfium
        with pdfium.PdfDocument(data) as document:
            if page > len(document):
                raise ApiException(40400, 'PDF 页码不存在', status_code=404)
            pdf_page = document[page - 1]
            try:
                width, height = pdf_page.get_size()
                scale = min(1.5, 1600 / max(width, height))
                bitmap = pdf_page.render(scale=scale)
                try:
                    image = bitmap.to_pil()
                    try:
                        output = io.BytesIO()
                        image.save(output, format='PNG')
                    finally:
                        image.close()
                    return Response(output.getvalue(), media_type='image/png', headers={
                        'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'})
                finally:
                    bitmap.close()
            finally:
                pdf_page.close()
    except ApiException:
        raise
    except Exception:
        raise ApiException(50300, '预览暂不可用，请下载完整 PDF', status_code=503)


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
