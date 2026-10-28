# MINOS integration of Pi Web

Vendored from https://github.com/agegr/pi-web commit `e533d9b3975f8a74b378d5007c92fdf4d15d3fba` (0.12.2), retaining original MIT LICENSE and complete Next.js UI/API/Pi SDK backend. This is not a visual clone or a mock chat adapter.

## Architecture

Pi Web is now the only frontend at port 5173 (`MINOS_GATEWAY=1`), with the Python business API retained at 8000. Account login and all active business pages render in this same Next/React app. The Python manager retains a separate Pi production process per account on loopback ports 30141–30240, with separate `PI_CODING_AGENT_DIR` and workspace. The gateway forwards SDK APIs/SSE to the authenticated account's server-recorded endpoint; no application iframe or legacy Vite service is used. The interview avatar alone retains its self-contained animation iframe.

MINOS launch tickets are single-use/60 seconds. Per-process capability and per-account cookie names avoid mixing account sessions across ports (cookies do not isolate by port). Python validates every token against its account/process. Next proxy preserves upstream Host/Origin checks and requires MINOS auth for page/API/SSE. Backend restart invalidates capabilities; reconnect through MINOS.

## Local agent permission boundary

**Pi is a trusted local coding agent, NOT an OS sandbox or untrusted multi-tenant service.** Tools/terminal/plugins run with the current Windows account's privileges. Separate application data does not prevent a malicious command reading another directory. Never expose this setup to the public internet or use it for mutually untrusted users. Real isolation requires separate OS identities/containers/VMs. MINOS bridge environment variables are scrubbed from the normal bash/terminal/MCP inherited environment; deliberately running arbitrary code or loading malicious plugins can still access host resources.

## Resume extension

Normal Pi sessions register `resume_read`, `resume_update`, `resume_set_template`, `resume_compile` using SDK inline extension support. Tools call Python with a server-only capability; identity and Pi session id are supplied by server closure, not model args. Python maps Pi session ids to owned SQL conversations and reuses existing validation/revision checks/original templates. Compiled PDF is copied to `resume-previews/<pi-session>-r<revision>.pdf` in the selected user's workspace for upstream file preview. Old files are historical revisions. Forking into a new Pi session starts a separate resume document; navigating within a Pi session does not revert its external resume document. Chat-only mode intentionally does not expose resume tools.

## Build/run

Node >=22.19.0 required. From this directory: `npm.cmd ci`, then `npm.cmd run build` while no dev server is running. Original Google Noto Sans Mono variable font is bundled locally under `app/fonts` (OFL license) to avoid contacting Google Fonts at build time; UI font identity/design retained.

Start MINOS normally, log in, open chat, acknowledge permissions. Python launcher requires an existing production `.next/BUILD_ID`; never start per-user `next dev` instances sharing a dev lock. Model credentials are copied server-side into private per-user Pi config; do not commit `.runtime` or provider credentials.

## Upstream changes

- `proxy.ts` and `lib/minos-auth.ts`: authenticated MINOS launch and cookie verification, private shared token for separately bundled server workers.
- `app/minos-connect/route.ts`: one-use launch exchange, redirect without ticket.
- `lib/rpc-manager.ts`/`lib/minos-resume-extension.ts`: normal-session resume extension.
- `lib/project-command-env.ts`, `lib/terminal-manager.ts`: strip MINOS bridge env from ordinary child commands.
- `app/layout.tsx`: same Noto Sans Mono font, local instead of network download.

## Unified business shell

Native business sources live in `components/minos`, with scoped CSS inheriting Pi theme tokens. AppShell switches React content directly, keeping chat mounted. Knowledge, college/major, chapter notes/quizzes, interview, learning review, onboarding and admin review are native Pi Web pages. The retired Vite frontend directory has been deleted; there is no second frontend build or iframe application to maintain. Business navigation uses a local memory router synchronized with the Pi navigation path; chapter selection inserts a Pi draft without auto-sending. Business API calls use `/api/business/*`, with server-side JWT refresh and no browser credential storage. `/login` uses the migrated account form; upstream password login is preserved for non-gateway mode. `/api/minos/account` manages a random HttpOnly account session, `/api/minos/connect` exchanges the one-use backend launch ticket server-side. Host/Origin guards apply to login, business and SDK APIs. Missing model configuration does not prevent account login or native business browsing. Interview final reports remain rule-based; the true model feedback boundary is unchanged.

## Career generative UI

Normal MINOS sessions append a career-specific system instruction using the SDK `before_agent_start` hook. Assistant text may contain a fenced `minos-ui` v1 data block; `career-ui.ts` validates an allowlisted schema and MessageView renders approved React components rather than model-supplied HTML/scripts. Supported layouts: job-match matrix, resume before/after review, interview feedback, action checklist, user-reported application tracker. Unknown/invalid complete blocks fall back to Markdown; unfinished blocks show a pending notice. Original assistant text stays in Pi transcripts and exports.

Follow-up buttons are session-scoped draft insertion only, not tool execution or automatic messages. Action checklist ticks are local component state (not persisted, not external completion). Resume suggestions do not save automatically. Tracker statuses are user-reported, not synchronized with recruitment websites. Scores are displayed only with explicit bounded score/maxScore and evidence, and are practice feedback, never hiring probability. Chat-only and subagent sessions retain their original no-extension semantics and do not receive the career instruction automatically.

Retain all upstream attribution when distributing. Existing MINOS database and uncommitted changes were preserved when creating branch `feature/pi-web-agent-integration`.
