"""Authenticated conversation resumes. Caller supplies a synchronous Session per call.

Only structured text is accepted; compilation always goes through the fixed,
escaping upstream-template renderer, never model/user supplied TeX.
"""
import json
from urllib.parse import quote

from pydantic import ValidationError
from sqlalchemy import delete, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.responses import ApiException
from app.models.chat import ChatSession, ResumeDocument, ResumeDocumentHistory
from app.resume_schemas import DocumentUndo, DocumentWrite, Resume, ResumeUpdate, TemplateUpdate
from app.services import resume_service
from app.services.resume_tools import TOOLS

MAX_DOCUMENT_BYTES = 60_000


def _error(status, message):
    raise ApiException(status * 100, message, status_code=status)


def _owned(db, user_id, conversation_id):
    if not db.scalar(select(ChatSession.id).where(ChatSession.id == conversation_id, ChatSession.user_id == user_id)):
        _error(404, '会话不存在')


def _row(db, user_id, conversation_id):
    return db.scalar(select(ResumeDocument).where(ResumeDocument.user_id == user_id,
        ResumeDocument.conversation_id == conversation_id).execution_options(populate_existing=True))


def _state(row):
    return {'resume': Resume.model_validate_json(row.resume_json).model_dump() if row else Resume().model_dump(),
            'template': row.template if row else 'classic', 'revision': row.revision if row else 0,
            'exists': row is not None}


def delete_document(db: Session, user_id: str, conversation_id: str):
    """Delete private document/cache in the caller's session-deletion transaction.

    Call before deleting ChatSession; this deliberately does not commit.
    """
    _owned(db, user_id, conversation_id)
    db.execute(delete(ResumeDocumentHistory).where(ResumeDocumentHistory.user_id == user_id,
        ResumeDocumentHistory.conversation_id == conversation_id))
    db.execute(delete(ResumeDocument).where(ResumeDocument.user_id == user_id,
        ResumeDocument.conversation_id == conversation_id))


def read_document(db: Session, user_id: str, conversation_id: str):
    _owned(db, user_id, conversation_id)
    return _state(_row(db, user_id, conversation_id))


def _validated(schema, value):
    try:
        return schema.model_validate(value)
    except (ValidationError, TypeError, ValueError):
        _error(400, '简历工具参数不合法，请提供完整结构和有效修订号')


def _history_query(user_id, conversation_id):
    return select(ResumeDocumentHistory).where(ResumeDocumentHistory.user_id == user_id,
        ResumeDocumentHistory.conversation_id == conversation_id)


def _section_text(section):
    if section is None:
        return ''
    lines = [section.get('title', ''), *section.get('items', [])]
    for entry in section.get('entries', []):
        lines.extend([entry.get(key, '') for key in ('heading', 'subtitle', 'location', 'dates')])
        lines.extend(entry.get('items', []))
    column = section.get('column', 'auto')
    lines.append('排版位置：' + {'auto': '自动', 'left': '左栏', 'right': '右栏'}.get(column, '自动'))
    return '\n'.join(line for line in lines if line)


def _changes(before, after):
    changes = []
    for key, label in [('name', '姓名'), ('contact', '联系方式'), ('summary', '个人简介')]:
        old, new = before['resume'].get(key, ''), after['resume'].get(key, '')
        if old != new:
            changes.append({'field': label, 'before': old, 'after': new})
    old_sections, new_sections = before['resume'].get('sections', []), after['resume'].get('sections', [])
    for index in range(max(len(old_sections), len(new_sections))):
        old = old_sections[index] if index < len(old_sections) else None
        new = new_sections[index] if index < len(new_sections) else None
        if old != new:
            changes.append({'field': f'第 {index + 1} 个内容板块', 'before': _section_text(old), 'after': _section_text(new)})
    if before['template'] != after['template']:
        labels = {'classic': '经典单栏', 'sidebar': '侧栏双栏'}
        changes.append({'field': '简历模板', 'before': labels.get(before['template'], '原模板'),
                        'after': labels.get(after['template'], '新模板')})
    return changes


def read_history(db, user_id, conversation_id):
    _owned(db, user_id, conversation_id)
    current = _state(_row(db, user_id, conversation_id))
    rows = db.scalars(_history_query(user_id, conversation_id).order_by(ResumeDocumentHistory.revision.desc())).all()
    return {'revision': current['revision'], 'canUndo': any(row.action == 'edit' and not row.consumed for row in rows),
            'items': [{'revision': row.revision + 1, 'action': row.action,
                       'createdAt': row.created_at.isoformat() if row.created_at else None,
                       'summary': ('撤销修改：' if row.action == 'undo' else '修改：') +
                           ('、'.join(change['field'] for change in json.loads(row.changes_json)) or '内容未变化'),
                       'changes': json.loads(row.changes_json)} for row in rows]}


def undo_document(db, user_id, conversation_id, data):
    _owned(db, user_id, conversation_id)
    req = _validated(DocumentUndo, data)
    if _state(_row(db, user_id, conversation_id))['revision'] != req.expectedRevision:
        _error(409, '简历已更新，请重新读取后撤销')
    target = db.scalar(_history_query(user_id, conversation_id).where(
        ResumeDocumentHistory.action == 'edit', ResumeDocumentHistory.consumed == 0)
        .order_by(ResumeDocumentHistory.revision.desc()).limit(1))
    if target is None:
        _error(409, '没有可撤销的修改（仅保留最近 20 次变更）')
    return _save(db, user_id, conversation_id, req.expectedRevision,
        Resume.model_validate_json(target.resume_json), target.template, undo_target=target.revision)


def _save(db, user_id, conversation_id, expected, resume=None, template=None, undo_target=None, include_changes=False):
    _owned(db, user_id, conversation_id)
    row = _row(db, user_id, conversation_id)
    current = _state(row)
    if current['revision'] != expected:
        _error(409, '简历已更新，请重新读取后修改')
    state = {'resume': resume.model_dump() if resume is not None else current['resume'],
             'template': template if template is not None else current['template'],
             'revision': expected + 1, 'exists': True}
    if len(json.dumps(state, ensure_ascii=False, separators=(',', ':')).encode('utf-8')) > MAX_DOCUMENT_BYTES:
        _error(400, '简历内容过长（完整状态不得超过 60KB）')
    values = {'resume_json': json.dumps(state['resume'], ensure_ascii=False), 'template': state['template'],
              'revision': state['revision'], 'pdf_revision': None, 'pdf_data': None, 'warnings_json': '[]'}
    try:
        if row is None:
            db.add(ResumeDocument(user_id=user_id, conversation_id=conversation_id, **values))
        else:
            result = db.execute(update(ResumeDocument).where(ResumeDocument.user_id == user_id,
                ResumeDocument.conversation_id == conversation_id, ResumeDocument.revision == expected)
                .values(**values).execution_options(synchronize_session=False))
            if result.rowcount != 1:
                db.rollback()
                _error(409, '简历已更新，请重新读取后修改')
        changes = _changes(current, state)
        # The CAS write, old text snapshot, undo consumption and pruning commit
        # together. Undo snapshots are audit-only, never new undo targets.
        db.add(ResumeDocumentHistory(user_id=user_id, conversation_id=conversation_id,
            revision=expected, resume_json=json.dumps(current['resume'], ensure_ascii=False),
            template=current['template'], action='undo' if undo_target is not None else 'edit',
            changes_json=json.dumps(changes, ensure_ascii=False)))
        if undo_target is not None:
            consumed = db.execute(update(ResumeDocumentHistory).where(
                ResumeDocumentHistory.user_id == user_id, ResumeDocumentHistory.conversation_id == conversation_id,
                ResumeDocumentHistory.revision == undo_target, ResumeDocumentHistory.action == 'edit',
                ResumeDocumentHistory.consumed == 0).values(consumed=1))
            if consumed.rowcount != 1:
                db.rollback()
                _error(409, '撤销记录已变化，请重新读取后重试')
        db.flush()
        db.execute(delete(ResumeDocumentHistory).where(ResumeDocumentHistory.user_id == user_id,
            ResumeDocumentHistory.conversation_id == conversation_id,
            ResumeDocumentHistory.revision < state['revision'] - 20))
        db.commit()
    except IntegrityError:
        db.rollback()
        _error(409, '简历已更新，请重新读取后修改')
    except Exception:
        db.rollback()
        raise
    if include_changes:
        state.update(previousRevision=current['revision'], changes=changes)
    return state


def write_document(db, user_id, conversation_id, data):
    _owned(db, user_id, conversation_id)
    req = _validated(DocumentWrite, data)
    return _save(db, user_id, conversation_id, req.expectedRevision, req.resume, req.template)


def _compile_result(conversation_id, revision, template, warnings):
    return {'revision': revision, 'template': template,
            'pdfUrl': f'/api/resume/documents/{quote(conversation_id, safe="")}/pdf?revision={revision}',
            'warnings': warnings}


def compile_document(db, user_id, conversation_id):
    _owned(db, user_id, conversation_id)
    row = _row(db, user_id, conversation_id)
    state = _state(row)
    if row is not None and row.pdf_revision == row.revision and row.pdf_data:
        return _compile_result(conversation_id, row.revision, row.template, json.loads(row.warnings_json))
    # Persist an empty draft without inventing content; compilation itself does not
    # change the document revision. Unique PK makes simultaneous first writes safe.
    if row is None:
        try:
            db.add(ResumeDocument(user_id=user_id, conversation_id=conversation_id,
                resume_json=json.dumps(state['resume']), template='classic', revision=0))
            db.commit()
        except IntegrityError:
            db.rollback()
            _error(409, '简历已更新，请重新读取后编译')
    db.commit()  # do not hold a read transaction during the compiler subprocess
    try:
        source = resume_service.render(Resume.model_validate(state['resume']), state['template'])
        pdf, warnings = resume_service.compile_pdf(source, state['template'])
    except Exception:
        _error(503, 'PDF 编译失败或超时，请缩短内容、切换模板后重试')
    _owned(db, user_id, conversation_id)
    result = db.execute(update(ResumeDocument).where(ResumeDocument.user_id == user_id,
        ResumeDocument.conversation_id == conversation_id, ResumeDocument.revision == state['revision'])
        .values(pdf_revision=state['revision'], pdf_data=pdf, warnings_json=json.dumps(warnings, ensure_ascii=False))
        .execution_options(synchronize_session=False))
    if result.rowcount != 1:
        db.rollback()
        _error(409, '编译期间简历已更新，旧 PDF 不可用，请重新编译')
    db.commit()
    return _compile_result(conversation_id, state['revision'], state['template'], warnings)


def read_pdf(db, user_id, conversation_id, revision):
    _owned(db, user_id, conversation_id)
    row = _row(db, user_id, conversation_id)
    if row is None or row.revision != revision:
        _error(409, 'PDF 修订号与当前简历不一致，请重新编译')
    if row.pdf_revision != revision or not row.pdf_data:
        _error(404, '当前版本尚未编译 PDF')
    return row.pdf_data


def _require_complete_resume(value):
    """Prevent default-filled partial replacements silently deleting existing data."""
    if not isinstance(value, dict) or not {'name', 'contact', 'summary', 'sections'} <= value.keys():
        _error(400, 'resume_update 必须提交完整 resume，先 resume_read 并保留未修改内容')
    sections = value['sections']
    if not isinstance(sections, list):
        _error(400, 'sections 必须是数组')
    for section in sections:
        if not isinstance(section, dict) or not {'title', 'items', 'entries', 'column'} <= section.keys():
            _error(400, '必须保留每个 section 的 title/items/entries/column')
        if not isinstance(section['entries'], list):
            _error(400, 'entries 必须是数组')
        for entry in section['entries']:
            if not isinstance(entry, dict) or not {'heading', 'subtitle', 'location', 'dates', 'items'} <= entry.keys():
                _error(400, '必须保留每个 entry 的完整字段')


def execute_tool(db: Session, user_id: str, conversation_id: str, name: str, args: dict):
    """Do not share the Session across threads/calls; errors are ApiException.

    Successful document tools return the COMPLETE state (no generic truncation).
    No authorization context or document identity is accepted from model args.
    """
    _owned(db, user_id, conversation_id)
    if not isinstance(args, dict):
        _error(400, '工具参数必须是对象')
    if name in ('resume_read', 'resume_compile'):
        if args:
            _error(400, '此工具不接受参数')
        return read_document(db, user_id, conversation_id) if name == 'resume_read' else compile_document(db, user_id, conversation_id)
    if name == 'resume_update':
        _require_complete_resume(args.get('resume'))
        req = _validated(ResumeUpdate, args)
        return _save(db, user_id, conversation_id, req.expectedRevision, resume=req.resume, include_changes=True)
    if name == 'resume_set_template':
        req = _validated(TemplateUpdate, args)
        return _save(db, user_id, conversation_id, req.expectedRevision, template=req.template, include_changes=True)
    _error(400, '未知简历工具')
