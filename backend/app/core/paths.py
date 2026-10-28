"""Read-only application resources and per-user writable state (never CWD-based)."""
import os
from pathlib import Path

APP_DIR = Path(__file__).resolve().parents[1]
INSTALL_ROOT = APP_DIR.parent.parent


def data_directory() -> Path:
    configured = os.environ.get("MINOS_DATA_DIR")
    if configured:
        path = Path(configured).expanduser()
        if not path.is_absolute():
            raise ValueError("MINOS_DATA_DIR must be an absolute path")
        return path.resolve()
    if os.name == "nt":
        base = Path(os.environ.get("LOCALAPPDATA") or Path.home() / "AppData" / "Local")
    else:
        base = Path(os.environ.get("XDG_DATA_HOME") or Path.home() / ".local" / "share")
    return (base / "MINOS").resolve()


DATA_DIR = data_directory()


def resource_path(*parts: str) -> Path:
    """Resources retain their app-relative layout in the relocatable distribution."""
    return APP_DIR.joinpath(*parts)
