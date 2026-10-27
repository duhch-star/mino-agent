# Windows relocatable Python backend

Prefer the CPython 3.12 embeddable distribution (same architecture as native wheels), not PyInstaller. Enable `import site` in its `python312._pth`, provision packages at packaging time with pip using `requirements-local.txt`, and keep Python DLLs, standard-library zip, extensions and the complete installed site-packages distribution together. Do not require system Python/pip at runtime. Run exactly one worker:

```powershell
$env:MINOS_DATA_DIR = "$env:LOCALAPPDATA\MINOS"
$env:MINOS_APP_ROOT = '<absolute installation root>'
$env:MINOS_DESKTOP = '1'
# Add the bundled node directory to PATH. Explicitly add backend to the embedded
# Python _pth file (PYTHONPATH alone is ignored by isolated embeddable Python).
# Set working directory to the installed backend; never rely on user CWD.
<bundled-python.exe> -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 1
```

No desktop build or executable bundling is required by this backend change. `MINOS_APP_ROOT/pi-web` remains read-only installed sidecar content. The launcher's runtime environment must set these variables before importing any `app` modules. `MINOS_DATA_DIR` must be absolute and defaults to `%LOCALAPPDATA%/MINOS` on Windows. Relative SQLite paths and `UPLOAD_DIR` are anchored to this data directory, never CWD. SQLite URI filenames are deliberately rejected; ordinary absolute paths and `:memory:` are supported. Database parent directories are created before engine use. Existing checkout databases are never copied or auto-migrated.

## User configuration / secrets

The launcher may create/open `<MINOS_DATA_DIR>/.env` with private ACLs. Only this `.env` is read; `backend/.env` and CWD `.env` are never read. Real process environment overrides the file. Edit configuration while stopped and restart the backend. Example (placeholders only):

```dotenv
LLM_API_KEY=
LLM_BASE_URL=
LLM_MODEL=glm-4-flash
INTERVIEW_LLM_MODEL=
MINERU_API_KEY=
MAMBO_TTS_KEY=
# RESUME_XELATEX=C:/optional/tex/bin/xelatex.exe
```

Do not set `SEED_DEMO_DATA=true` in a release. The default is false, independent of `DEBUG`; no known-password admin/demo users or sample database records are automatically inserted. If no `SECRET_KEY` is configured, the backend creates a random persistent `.jwt-secret` in the data directory rather than using a shared shipped signing key. The data directory also stores `xiaomin.db`, uploads, per-user workspaces and `runtime/pi-web` (including provider-auth sidecar files). Protect the whole directory with a per-user ACL; never expose it as static HTTP content, include it in installers, or log its contents. Back up `.jwt-secret` with the DB to retain sessions; passwords use independently salted PBKDF2.

## First account setup

`GET /api/auth/desktop-status` returns `{ "setupRequired": true }` only in `MINOS_DESKTOP=1` mode and from a real loopback peer. `POST /api/auth/desktop-setup` accepts `{ "username": "...", "password": "..." }` (8–64 password characters), creates one ordinary `user`, and returns `{ "ok": true, "username": "..." }`. Then use existing `/api/auth/login`. Once *any* user exists setup returns HTTP 409. SQLite `BEGIN IMMEDIATE` plus the single-worker process lock prevents concurrent bootstrap. These endpoints reject requests carrying `Origin`; browser frontends must call a same-origin gateway which performs the backend fetch without forwarding `Origin`. Never expose the backend externally or trust forwarded client addresses. These are local desktop initialization endpoints, not internet deployment registration/authentication hardening. The legacy `/v1` development verification-code workflow is unchanged.

## Include read-only resources

Keep the backend `app` package layout, plus all of these non-Python assets:

- `app/data/{colleges,textbooks,guides,interview}.json` (loaded at import; required even if knowledge UI is not opened).
- The complete `app/resume_templates/` tree, preserving upstream `.tex`, `.xtx`, `.cls`, fonts, `.bib`, preview PNG/PDF, manifests, README and license/OFL/Apache/MIT files. PDF export copies template assets and requires their relative layout.
- Optional complete XeLaTeX/TeX Live (xeCJK + Fandol) or Tectonic runtime and TeX resources for PDF compilation; without it source ZIP/template browsing remains available but PDF compilation reports compiler unavailable. Use `RESUME_XELATEX` or a runtime PATH entry. No system LaTeX should be assumed by the installer.
- For Pi Web: installed root `pi-web` production build, full Node dependencies and compatible Node executable; the backend uses `node` from PATH and `MINOS_APP_ROOT/pi-web/node_modules/next/dist/bin/next`. Do not include its private development `.env` files.

Install `requirements-local.txt` for complete document format support (core FastAPI/Uvicorn/SQLAlchemy/Pydantic/JWT/multipart/httpx plus pdfplumber, pypdf, python-docx, openpyxl, xlrd, python-pptx, striprtf, lxml, olefile, PyYAML and transitive native wheels). Core-only `requirements.txt` supports the HTTP API but not every local document parser. Ship third-party dependency license notices. No local LLM weights are needed; LLM/MinerU/TTS use optional user-configured online providers, with no fake key bundled.

## Explicit packaging exclusions

Allowlist application modules and resources instead of recursively copying the checkout. Exclude **all** source `.env`/`.env.*` (except intentionally public templates), SQLite DBs and `-wal`/`-shm`, uploads, workspaces, `.runtime`, logs, caches, `__pycache__`, `.venv`, developer probes and tests. Never include real API credentials, user data, pre-created `.jwt-secret`, or sidecar auth/state files.

## Offline checks

`python -m unittest test_portable_runtime -v` uses isolated child processes with temporary synthetic config/data. It verifies environment precedence, unrelated CWD and Chinese/spaced data paths, absolute SQLite/upload paths, packaged resources, persisted generated signing key, clean startup without seeded users, loopback/mode/origin setup restrictions, real login and concurrent first-user protection. Other existing unit tests can run with a temporary `MINOS_DATA_DIR`; no provider network requests or desktop build are needed.
