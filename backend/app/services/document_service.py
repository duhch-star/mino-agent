"""附件文档解析服务：PDF / Word / Excel / PPT / TXT / MD / CSV / JSON / HTML / RTF → 文本

解析通道（按优先级）：
1. MinerU 在线 API（.env 配置 MINERU_API_KEY / MINERU_BASE_URL 时启用，仅对
   PDF / 图片等复杂版面效果最好；未配置则跳过）
2. 本地纯 Python 解析（无网络依赖，开箱即用）：
   - PDF   → pdfplumber（回退 pypdf）
   - DOCX  → python-docx（段落 + 表格）
   - XLSX  → openpyxl（所有工作表）
   - XLS   → xlrd
   - PPTX  → python-pptx（文本框 + 备注）
   - RTF   → striprtf
   - TXT/MD/CSV/JSON/HTML/YAML → 文本读取 / 结构化拼装
   - DOC/PPT（旧版二进制格式）→ 尽力用 olefile 提取，失败给出友好提示
"""
import logging
import time

from app.core.config import settings

logger = logging.getLogger(__name__)

MAX_EXTRACT_CHARS = 8000  # 注入 prompt 的最大字符数（防超长简历把上下文撑爆）


# ---------- 本地解析：每种格式一个函数 ----------

def _extract_pdf_local(path: str) -> str:
    texts = []
    try:
        import pdfplumber
        with pdfplumber.open(path) as pdf:
            for page in pdf.pages:
                t = page.extract_text() or ""
                if t.strip():
                    texts.append(t)
        if texts:
            return "\n\n".join(texts)
    except Exception as exc:  # noqa: BLE001
        logger.warning("pdfplumber 解析失败 %s: %s", path, exc)
    try:
        from pypdf import PdfReader
        reader = PdfReader(path)
        return "\n\n".join((page.extract_text() or "") for page in reader.pages)
    except Exception as exc:  # noqa: BLE001
        logger.warning("pypdf 解析失败 %s: %s", path, exc)
    return ""


def _extract_docx_local(path: str) -> str:
    try:
        import docx
        d = docx.Document(path)
        parts = [p.text for p in d.paragraphs if p.text.strip()]
        for table in d.tables:
            for row in table.rows:
                cells = [c.text.strip() for c in row.cells]
                if any(cells):
                    parts.append(" | ".join(cells))
        return "\n".join(parts)
    except Exception as exc:  # noqa: BLE001
        logger.warning("python-docx 解析失败 %s: %s", path, exc)
        return ""


def _extract_doc_legacy(path: str) -> str:
    """旧版 .doc（OLE 复合文档）：尽力提取 WordDocument 流中的可打印文本。"""
    try:
        import olefile
        if not olefile.isOleFile(path):
            return ""
        ole = olefile.OleFileIO(path)
        try:
            if ole.exists("WordDocument"):
                data = ole.openstream("WordDocument").read()
            else:
                data = ole.openstreams()[0].read()
        finally:
            ole.close()
        # 提取连续可打印字符（含中文宽字符），容忍噪声
        raw = data.decode("latin-1", "ignore")
        chars = []
        for ch in raw:
            o = ord(ch)
            if ch in "\r\n\t" or 0x20 <= o < 0x7F or 0x80 <= o:
                chars.append(ch)
        text = "".join(chars)
        # 去重连续空行
        import re
        return re.sub(r"\n{3,}", "\n\n", text).strip()[:MAX_EXTRACT_CHARS]
    except Exception as exc:  # noqa: BLE001
        logger.warning("olefile 解析 .doc 失败 %s: %s", path, exc)
        return ""


def _extract_xlsx_local(path: str) -> str:
    try:
        from openpyxl import load_workbook
        wb = load_workbook(path, read_only=True, data_only=True)
        out = []
        for ws in wb.worksheets:
            out.append(f"# 工作表: {ws.title}")
            for row in ws.iter_rows(values_only=True):
                cells = ["" if v is None else str(v).strip() for v in row]
                if any(cells):
                    out.append(" | ".join(cells))
        wb.close()
        return "\n".join(out)
    except Exception as exc:  # noqa: BLE001
        logger.warning("openpyxl 解析失败 %s: %s", path, exc)
        return ""


def _extract_xls_local(path: str) -> str:
    try:
        import xlrd
        wb = xlrd.open_workbook(path)
        out = []
        for ws in wb.sheets():
            out.append(f"# 工作表: {ws.name}")
            for r in range(ws.nrows):
                cells = [str(ws.cell_value(r, c)).strip() for c in range(ws.ncols)]
                if any(cells):
                    out.append(" | ".join(cells))
        return "\n".join(out)
    except Exception as exc:  # noqa: BLE001
        logger.warning("xlrd 解析失败 %s: %s", path, exc)
        return ""


def _extract_pptx_local(path: str) -> str:
    try:
        from pptx import Presentation
        prs = Presentation(path)
        out = []
        for idx, slide in enumerate(prs.slides, 1):
            out.append(f"# 幻灯片 {idx}")
            for shape in slide.shapes:
                if hasattr(shape, "text") and shape.text.strip():
                    out.append(shape.text.strip())
            if slide.has_notes_slide and slide.notes_slide.notes_text_frame:
                notes = slide.notes_slide.notes_text_frame.text.strip()
                if notes:
                    out.append(f"[备注] {notes}")
        return "\n".join(out)
    except Exception as exc:  # noqa: BLE001
        logger.warning("python-pptx 解析失败 %s: %s", path, exc)
        return ""


def _extract_rtf_local(path: str) -> str:
    try:
        from striprtf.striprtf import rtf_to_text
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            return rtf_to_text(f.read())
    except Exception as exc:  # noqa: BLE001
        logger.warning("striprtf 解析失败 %s: %s", path, exc)
        return ""


def _extract_csv_local(path: str) -> str:
    import csv
    try:
        rows = []
        for enc in ("utf-8-sig", "gbk", "utf-8"):
            try:
                with open(path, "r", encoding=enc, newline="") as f:
                    for row in csv.reader(f):
                        cells = [c.strip() for c in row]
                        if any(cells):
                            rows.append(" | ".join(cells))
                break
            except (UnicodeDecodeError, csv.Error):
                continue
        return "\n".join(rows)
    except Exception as exc:  # noqa: BLE001
        logger.warning("csv 解析失败 %s: %s", path, exc)
        return ""


def _extract_json_local(path: str) -> str:
    import json
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return json.dumps(data, ensure_ascii=False, indent=2)
    except Exception as exc:  # noqa: BLE001
        logger.warning("json 解析失败 %s: %s", path, exc)
        return ""


def _extract_html_local(path: str) -> str:
    try:
        from lxml import html
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            doc = html.fromstring(f.read())
        # 移除脚本/样式
        for el in doc.xpath("//script | //style | //noscript"):
            el.getparent().remove(el)
        text = doc.text_content()
        import re
        return re.sub(r"[ \t]+", " ", re.sub(r"\n{3,}", "\n\n", text)).strip()
    except Exception as exc:  # noqa: BLE001
        logger.warning("lxml 解析 HTML 失败 %s: %s", path, exc)
        return ""


def _extract_text_file(path: str) -> str:
    for enc in ("utf-8", "utf-8-sig", "gbk", "utf-16"):
        try:
            with open(path, "r", encoding=enc) as f:
                return f.read()
        except (UnicodeDecodeError, OSError):
            continue
    return ""


# ---------- 格式分发 ----------

def _pick_ext(lower_name: str, mime: str) -> str:
    """从文件名扩展名或 MIME 推断格式 key"""
    for ext in (".pdf", ".docx", ".doc", ".xlsx", ".xls", ".pptx", ".ppt",
                ".rtf", ".csv", ".json", ".html", ".htm", ".md", ".markdown",
                ".txt", ".yaml", ".yml", ".log", ".xml"):
        if lower_name.endswith(ext):
            return ext
    m = (mime or "").lower()
    table = {
        "application/pdf": ".pdf",
        "msword": ".doc",
        "wordprocessingml": ".docx",
        "ms-excel": ".xls",
        "spreadsheetml": ".xlsx",
        "ms-powerpoint": ".ppt",
        "presentationml": ".pptx",
        "rtf": ".rtf",
        "text/plain": ".txt",
        "text/csv": ".csv",
        "text/html": ".html",
        "json": ".json",
    }
    for key, ext in table.items():
        if key in m:
            return ext
    return ".txt"


def _extract_local(path: str, mime: str = "", filename: str = "") -> str:
    lower_name = (filename or path).lower()
    ext = _pick_ext(lower_name, mime)
    if ext == ".pdf":
        return _extract_pdf_local(path)
    if ext == ".docx":
        return _extract_docx_local(path)
    if ext == ".doc":
        return _extract_doc_legacy(path) or (
            "【旧版 .doc 格式】本地解析未能完整提取内容，建议将文件另存为 .docx 后重新上传。")
    if ext == ".xlsx":
        return _extract_xlsx_local(path)
    if ext == ".xls":
        return _extract_xls_local(path)
    if ext == ".pptx":
        return _extract_pptx_local(path)
    if ext == ".ppt":
        return "【旧版 .ppt 格式】本地暂未内置解析，建议将文件另存为 .pptx 后重新上传。"
    if ext == ".rtf":
        return _extract_rtf_local(path)
    if ext in (".csv",):
        return _extract_csv_local(path)
    if ext == ".json":
        return _extract_json_local(path)
    if ext in (".html", ".htm"):
        return _extract_html_local(path)
    if ext in (".md", ".markdown", ".txt", ".log", ".xml", ".yaml", ".yml"):
        return _extract_text_file(path)
    return _extract_text_file(path)


# ---------- MinerU 在线 API（可选） ----------

def _mineru_available() -> bool:
    return bool(settings.mineru_api_key and settings.mineru_base_url)


async def _extract_with_mineru(path: str, mime: str) -> str | None:
    """调用 MinerU 在线 API：上传文件 → 轮询任务 → 返回 Markdown。

    兼容 mineru.net v4 官方接口（api.mineru.net），也允许在 .env 内
    替换为自建 / 代理的 MinerU 服务（MINERU_BASE_URL 指向 /v4 根路径）。
    """
    import httpx
    base = settings.mineru_base_url.rstrip("/")
    headers = {"Authorization": f"Bearer {settings.mineru_api_key}"}
    async with httpx.AsyncClient(timeout=300) as client:
        # 1) 创建解析任务（multipart 上传本地文件）
        with open(path, "rb") as f:
            resp = await client.post(
                f"{base}/extract-task",
                headers=headers,
                files={"file": (path.split("/")[-1], f, mime or "application/octet-stream")},
            )
        resp.raise_for_status()
        task_id = resp.json().get("data", {}).get("task_id")
        if not task_id:
            logger.warning("MinerU 未返回 task_id: %s", resp.text[:200])
            return None
        # 2) 轮询任务状态（最长约 120s）
        import asyncio
        deadline = time.time() + 120
        while time.time() < deadline:
            await asyncio.sleep(3)
            q = await client.get(f"{base}/extract-task/{task_id}", headers=headers)
            q.raise_for_status()
            state = q.json().get("data", {}).get("state", "")
            if state in ("succeed", "done", "completed"):
                content = (q.json().get("data", {})
                           .get("full_content")
                           or q.json().get("data", {}).get("markdown")
                           or q.json().get("data", {}).get("content")
                           or "")
                return content or None
            if state in ("failed", "error", "canceled"):
                logger.warning("MinerU 任务失败: %s", q.text[:200])
                return None
    logger.warning("MinerU 轮询超时")
    return None


# ---------- 对外入口 ----------

def extract_document_sync(path: str, mime: str = "", filename: str = "") -> str:
    """同步解析（上传时使用）：本地纯 Python 多格式解析。

    MinerU 需异步轮询，同步入口不调用；若配置了 MINERU 且希望获得
    更强版面解析，请使用异步入口 extract_document。
    """
    if not path:
        return ""
    text = _extract_local(path, mime, filename)
    return (text or "")[:MAX_EXTRACT_CHARS]


async def extract_document(path: str, mime: str = "", filename: str = "") -> str:
    """异步入口（对话期间按需解析）：MinerU 在线 API 优先，失败降级本地。"""
    if not path:
        return ""
    lower_name = (filename or path).lower()
    # 优先 MinerU（若已配置）—— 对 PDF / 图片等复杂版面效果最好
    if _mineru_available() and (lower_name.endswith(".pdf") or lower_name.endswith(".png")
                                or lower_name.endswith(".jpg") or lower_name.endswith(".jpeg")):
        try:
            text = await _extract_with_mineru(path, mime)
            if text:
                return text[:MAX_EXTRACT_CHARS]
        except Exception as exc:  # noqa: BLE001
            logger.warning("MinerU 在线解析失败，降级本地: %s", exc)
    text = _extract_local(path, mime, filename)
    return (text or "")[:MAX_EXTRACT_CHARS]