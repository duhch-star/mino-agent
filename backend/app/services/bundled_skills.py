"""Provision audited, packaged Markdown skills without network or user-file overwrites."""
import hashlib
import json
from pathlib import Path
import re
import shutil

from app.core.paths import resource_path


def install_bundled_skills(agent: Path, source: Path | None = None):
    source = source or resource_path('bundled_skills')
    manifest = source / 'manifest.json'
    if not manifest.is_file():
        raise RuntimeError('内置求职技能资源缺失，请修复 MINOS 安装包')
    entries = json.loads(manifest.read_text(encoding='utf-8-sig'))['skills']
    target = agent / 'skills'
    if target.is_symlink():
        raise RuntimeError('账号 skills 目录不能是符号链接')
    target.mkdir(exist_ok=True)
    installed = []
    for entry in entries:
        slug = entry['id']
        if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', slug) or entry['path'] != slug:
            raise RuntimeError('内置技能清单不合法')
        origin = source / slug
        destination = target / slug
        # Existing user skills, even edited/disabled ones, are never replaced.
        if destination.exists() or destination.is_symlink():
            continue
        files = entry['files']
        if 'SKILL.md' not in files:
            raise RuntimeError('内置技能缺少 SKILL.md')
        for name, digest in files.items():
            relative = Path(name)
            if relative.is_absolute() or '..' in relative.parts or ':' in name:
                raise RuntimeError('内置技能文件路径不合法')
            path = origin / relative
            if path.is_symlink() or not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != digest:
                raise RuntimeError('内置技能完整性校验失败：' + slug)
        # Only manifest-verified files are copied; no scripts or unexpected extras.
        destination.mkdir()
        try:
            for name in files:
                output = destination / name
                output.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(origin / name, output)
        except Exception:
            # Exact newly-created destination only, never an existing user skill.
            shutil.rmtree(destination)
            raise
        installed.append(slug)
    return installed
