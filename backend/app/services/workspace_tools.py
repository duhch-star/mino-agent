"""Bounded UTF-8 file tools. No shell, network, absolute paths or symlink traversal."""
import hashlib
import json
import os
import stat
from pathlib import Path, PureWindowsPath

from app.core.config import BASE_DIR

MAX_BYTES = 128 * 1024
MAX_OUTPUT = 16000


def workspace_for(user_id: str) -> Path:
    if not user_id:
        raise ValueError('文件工具需要先登录')
    key = hashlib.sha256(user_id.encode()).hexdigest()[:32]
    root = BASE_DIR / 'workspaces' / key
    root.mkdir(parents=True, exist_ok=True)
    return root.resolve()


def _path(root: Path, value: str) -> Path:
    if not isinstance(value, str) or not value or len(value) > 240:
        raise ValueError('path 必须是长度不超过 240 的相对路径')
    win = PureWindowsPath(value)
    parts = value.replace('\\', '/').split('/')
    if win.drive or win.root or Path(value).is_absolute() or any(p == '..' or ':' in p or p.endswith((' ', '.')) and p not in ('.', '') for p in parts):
        raise ValueError('只允许工作区相对路径，禁止上级路径、绝对路径和特殊路径')
    reserved = {'CON', 'PRN', 'AUX', 'NUL', *(f'COM{i}' for i in range(1, 10)), *(f'LPT{i}' for i in range(1, 10))}
    target = root
    for part in parts:
        if part in ('', '.'):
            continue
        if part.upper().split('.')[0] in reserved or any(ord(c) < 32 or c in '<>"|?*' for c in part):
            raise ValueError('非法文件名')
        target = target / part
        if target.is_symlink() or (target.exists() and getattr(target.lstat(), 'st_file_attributes', 0) & getattr(stat, 'FILE_ATTRIBUTE_REPARSE_POINT', 1024)):
            raise ValueError('不允许符号链接或目录联接')
    if not target.resolve().is_relative_to(root.resolve()):
        raise ValueError('路径超出工作区')
    if any(p.startswith('.') for p in target.relative_to(root).parts):
        raise ValueError('不允许访问隐藏配置文件')
    return target


def _read(path: Path) -> str:
    if not path.is_file():
        raise ValueError('文件不存在或不是普通文件')
    with path.open('rb') as source:
        data = source.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES or b'\0' in data:
        raise ValueError('仅支持不超过 128 KiB 的 UTF-8 文本文件')
    return data.decode('utf-8')


def execute(root: Path, name: str, arguments: dict) -> dict:
    if name not in {'list_files', 'read_file', 'write_file', 'edit_file', 'search_files'}:
        raise ValueError('未知工具')
    if not isinstance(arguments, dict):
        raise ValueError('入参必须为 JSON 对象')
    allowed = {
        'list_files': {'path'}, 'read_file': {'path', 'offset', 'limit'},
        'write_file': {'path', 'content'}, 'edit_file': {'path', 'old_text', 'new_text'},
        'search_files': {'path', 'query'},
    }[name]
    if set(arguments) - allowed:
        raise ValueError('包含不支持的参数')
    target = _path(root, arguments.get('path', '.'))
    relative = target.relative_to(root).as_posix()
    if name == 'list_files':
        if not target.is_dir():
            raise ValueError('目录不存在')
        entries = []
        for item in target.iterdir():
            if len(entries) >= 200:
                return {'path': relative, 'entries': entries, 'truncated': True}
            try:
                _path(root, item.relative_to(root).as_posix())
            except ValueError:
                continue
            entries.append({'name': item.name, 'type': 'directory' if item.is_dir() else 'file'})
        return {'path': relative, 'entries': entries, 'truncated': False}
    if name == 'read_file':
        text = _read(target)
        offset, limit = arguments.get('offset', 1), arguments.get('limit', 100)
        if type(offset) is not int or type(limit) is not int or offset < 1 or not 1 <= limit <= 200:
            raise ValueError('offset >= 1，limit 在 1 到 200 之间')
        lines = text.splitlines()
        selected = '\n'.join(f'{i+offset}: {line}' for i, line in enumerate(lines[offset-1:offset-1+limit]))
        return {'path': relative, 'content': selected[:MAX_OUTPUT], 'totalLines': len(lines), 'truncated': len(selected) > MAX_OUTPUT or offset-1+limit < len(lines)}
    if name == 'search_files':
        query = arguments.get('query')
        if not isinstance(query, str) or not 1 <= len(query) <= 200:
            raise ValueError('query 必须是 1 到 200 字符的普通文本')
        if not target.is_dir():
            raise ValueError('目录不存在')
        matches, scanned, visited = [], 0, 0
        for current, dirs, files in os.walk(target, followlinks=False):
            visited += 1
            if visited > 200:
                break
            safe_dirs = []
            for d in dirs:
                try:
                    _path(root, (Path(current)/d).relative_to(root).as_posix())
                    safe_dirs.append(d)
                except ValueError:
                    pass
            dirs[:] = safe_dirs
            for filename in files:
                scanned += 1
                if scanned > 200:
                    break
                try:
                    file = _path(root, (Path(current)/filename).relative_to(root).as_posix())
                    text = _read(file)
                except (ValueError, UnicodeError, OSError):
                    continue
                for number, line in enumerate(text.splitlines(), 1):
                    if query.casefold() in line.casefold():
                        matches.append({'path': file.relative_to(root).as_posix(), 'line': number, 'text': line[:300]})
                        if len(matches) >= 40:
                            return {'matches': matches, 'truncated': True}
            if scanned > 200:
                break
        return {'matches': matches, 'truncated': scanned > 200 or visited > 200}
    if name == 'write_file':
        content = arguments.get('content')
        if not isinstance(content, str) or len(content.encode('utf-8')) > MAX_BYTES:
            raise ValueError('content 必须是最多 128 KiB 的文本')
        if target.exists():
            raise ValueError('文件已存在，请先 read_file 再使用 edit_file 精确修改，禁止直接覆盖')
        existing = sum(1 for _ in root.rglob('*'))
        if existing >= 300:
            raise ValueError('工作区文件数量已达上限')
        target.parent.mkdir(parents=True, exist_ok=True)
        with target.open('x', encoding='utf-8', newline='') as output:
            output.write(content)
        return {'path': relative, 'bytesWritten': len(content.encode('utf-8')), 'created': True}
    text = _read(target)
    old, new = arguments.get('old_text'), arguments.get('new_text')
    if not isinstance(old, str) or not old or not isinstance(new, str):
        raise ValueError('old_text 必须非空，new_text 必须为文本')
    if text.count(old) != 1:
        raise ValueError('old_text 必须在文件中恰好匹配一次，请重新读取后修改')
    updated = text.replace(old, new, 1)
    if len(updated.encode('utf-8')) > MAX_BYTES:
        raise ValueError('修改后的文件超过 128 KiB')
    target.write_text(updated, encoding='utf-8', newline='')
    return {'path': relative, 'replacements': 1, 'bytesWritten': len(updated.encode('utf-8'))}


def _tool(name, description, properties, required):
    return {'type': 'function', 'function': {'name': name, 'description': description,
        'parameters': {'type': 'object', 'properties': properties, 'required': required, 'additionalProperties': False}}}


S = {'type': 'string'}
TOOLS = [
    _tool('list_files', '列出当前用户专用工作区目录，最多 200 项。路径只能为相对路径。', {'path': S}, []),
    _tool('read_file', '读取工作区 UTF-8 文本并返回行号；修改已有文件前必须先读。', {'path': S, 'offset': {'type': 'integer', 'minimum': 1}, 'limit': {'type': 'integer', 'minimum': 1, 'maximum': 200}}, ['path']),
    _tool('write_file', '仅创建新文本文件，不能覆盖已有文件。仅在用户要求保存/创建文件时调用。', {'path': S, 'content': S}, ['path', 'content']),
    _tool('edit_file', '精确替换工作区文件中唯一匹配的文本。仅在用户要求修改文件时调用。', {'path': S, 'old_text': S, 'new_text': S}, ['path', 'old_text', 'new_text']),
    _tool('search_files', '在工作区文本中搜索普通字符串（非正则），最多扫描 200 文件并返回 40 条。', {'path': S, 'query': S}, ['query']),
]
