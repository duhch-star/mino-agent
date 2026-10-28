"""Read uploaded documents only within an authenticated account workspace."""
from pathlib import Path
from app.core.responses import ApiException
from app.services.document_service import _extract_local, MAX_EXTRACT_CHARS


def read_workspace_document(workspace: str, requested: str) -> dict:
    root = Path(workspace).resolve()
    relative = Path(requested)
    if not requested or '\x00' in requested or '..' in relative.parts:
        raise ApiException(40000, '无效文档路径', status_code=400)
    target = (root / relative).resolve()
    if not target.is_relative_to(root):
        raise ApiException(40300, '只能读取当前账号工作区内的文档', status_code=403)
    if target.suffix.lower() not in {'.pdf', '.docx', '.doc'}:
        raise ApiException(41500, '支持 PDF、DOCX、DOC 文档', status_code=415)
    if not target.is_file():
        raise ApiException(40400, '文档不存在', status_code=404)
    if target.stat().st_size > 32 * 1024 * 1024:
        raise ApiException(41300, '文档超过32MiB解析上限', status_code=413)
    text = _extract_local(str(target), filename=target.name).strip()
    if not text:
        raise ApiException(42200, '未提取到文档文字：扫描PDF需OCR；加密、损坏或不支持的旧Word请另存为DOCX后重试', status_code=422)
    return {'name': target.name, 'text': text[:MAX_EXTRACT_CHARS], 'truncated': len(text) > MAX_EXTRACT_CHARS}
