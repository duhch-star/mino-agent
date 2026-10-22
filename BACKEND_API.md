# MINO AGENT Backend API Handoff

This document is the proposed frontend/backend contract for `src-pre`. The frontend currently uses mock data and local browser state; these routes are proposed and are not live service guarantees. Confirm unresolved product and infrastructure choices before implementation.

## Conventions

- Base URL: configure as `VITE_API_BASE_URL`; local development may proxy `/api` through Vite.
- JSON endpoints use `Content-Type: application/json` and UTF-8. File upload uses `multipart/form-data`.
- Authenticated endpoints use `Authorization: Bearer <accessToken>`. The server determines roles from the authenticated account. A client-supplied role must never grant permissions.
- Use ISO-8601 UTC timestamps. IDs are opaque strings.
- JSON errors use `{ "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [] }, "requestId": "..." }`. Use suitable HTTP status codes, including 400, 401, 403, 404, 409, 413, 422, and 500.
- Lists should return `{ "items": [], "nextCursor": null }` when pagination is applicable. The frontend currently has no pagination controls; initial endpoints may return all bounded items.

## Endpoint Inventory

| Area | Method and route | Request / response summary | Frontend status |
|---|---|---|---|
| Auth | `POST /api/auth/login` | username/password; access token and server-derived user | Mock API called; password is now passed |
| Auth | `POST /api/auth/refresh` | refresh token; rotated token pair | Not wired |
| Auth | `POST /api/auth/logout` | invalidate refresh token/session | Not wired |
| Auth | `GET /api/users/me` | current user profile and role | Not wired |
| Account | `DELETE /api/users/me/data` | delete account data according to retention policy | UI currently only clears local state flag |
| Usage | `GET /api/usage/me` | real usage and quota summary | Settings currently shows hardcoded demo values |
| Profile | `GET, PUT /api/users/me/profile` |求职方向、经验、目标岗位等画像 | PUT mock reserved; onboarding remains local |
| Knowledge | `GET /api/knowledge/colleges` | college summaries | Mock function exists; page reads local data |
| Knowledge | `GET /api/knowledge/colleges/{collegeId}` | college and majors | Mock function exists; page reads local data |
| Knowledge | `GET /api/knowledge/majors/{majorId}` | courses, skills, matching roles | Mock function exists; page reads local data |
| Knowledge | `GET /api/knowledge/textbooks` | textbook groups/tree | Mock function exists; page reads local data |
| Guides | `GET /api/guides` | guide summaries and metadata | Mock function exists; pages read local data |
| Guides | `GET /api/guides/{guideId}` | guide content and related guides | Mock function exists; pages read local data |
| Guides | `GET /api/guides/{guideId}/quiz` | quiz questions and options | Mock function exists; page reads local data |
| Learning | `GET, PUT /api/users/me/learning` | progress, bookmarks, notes and quiz results | PUT mock reserved; browser persistence remains local |
| Interview | `GET /api/interview/questions?position=&difficulty=` | question list | Mock function exists; configuration reads local data |
| Interview | `POST /api/interview/sessions` | create interview session from config | Mock function reserved; room does not call it |
| Interview | `POST /api/interview/sessions/{sessionId}/answers` | submit question/answer; return structured feedback | Mock function reserved; store currently calls legacy feedback mock |
| Interview | `POST /api/interview/sessions/{sessionId}/finish` | finish session and return report | Mock function reserved; room state is local |
| Interview | `POST /api/interview/feedback` | legacy one-shot feedback request | Mock function called by store |
| Chat | `POST /api/chat/sessions` | create conversation | Mock function reserved; session list remains local |
| Chat | `GET /api/chat/sessions` | list current user's sessions, including branch metadata | Mock function reserved; session list remains local |
| Chat | `PATCH /api/chat/sessions/{sessionId}` | rename conversation | Mock function reserved; rename remains local |
| Chat | `DELETE /api/chat/sessions/{sessionId}` | delete conversation and messages | Mock function reserved; delete remains local |
| Chat | `POST /api/chat/attachments` | upload files; return durable attachment IDs | Mock metadata only; no bytes are uploaded |
| Chat | `POST /api/chat` | SSE response; request schema below | Mock stream called by store |
| Chat | `POST /api/chat/feedback` | helpful/unhelpful rating for assistant message | Mock function reserved; feedback remains local |
| Career | `POST /api/career/resume/analyze` | resume text or attachment IDs; structured feedback | Existing mock API is not called by Career page |
| Career | `POST /api/career/jobs/match` | profile/resume and optional target; ranked matches | Mock function reserved; UI shows static examples |
| Career | `POST /api/career/star/organize` | raw experience; STAR sections and suggestions | Mock function reserved; UI links to guide only |
| Admin | `GET /api/review/drafts` | pending content drafts | Mock function exists; page uses local constants |
| Admin | `POST /api/review/drafts/{draftId}/decision` | approve/reject and optional reason | Existing `reviewDraft` mock needs route/schema alignment; page is local |

## Login

Request:

```json
{ "username": "candidate@example.com", "password": "..." }
```

Response:

```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "expiresIn": 3600,
  "user": { "id": "usr_123", "name": "Candidate", "role": "user" }
}
```

`role` is returned by the server. The UI's role selector only exists to demonstrate the admin and candidate views; it must not be sent as an authorization claim in production. Decide whether refresh tokens are cookie-based or returned to a secure desktop credential store before implementation.

## Chat Request and SSE

Request JSON:

```json
{
  "conversationId": "conv_123",
  "text": "请结合我的经历分析这个岗位",
  "context": { "title": "STAR 回答", "snippet": "...", "guideId": "star" },
  "mode": "career",
  "tool": "job_description",
  "depth": "standard",
  "attachmentIds": ["file_123"]
}
```

Allowed `mode`: `career`, `resume`, `interview`. Allowed `depth`: `standard`, `deep`. Tool IDs currently used by the UI: `resume_analysis`, `job_description`, `knowledge_search`, `star_stories`. Validate all values server-side. The current frontend still sends attachment metadata pending the upload flow; integration must change it to send `attachmentIds` after upload.

Response content type: `text/event-stream; charset=utf-8`. Each event is a complete SSE frame separated by a blank line. JSON payloads:

```text
event: activity
data: {"status":"running","label":"正在对照岗位要求"}

event: delta
data: {"delta":"建议先突出你的项目结果。"}

event: done
data: {"messageId":"msg_456","usage":{"inputTokens":120,"outputTokens":90},"performance":{"durationMs":2400,"firstTokenMs":500,"tokensPerSecond":37.5},"citations":[{"type":"guide","id":"star","title":"STAR 回答"}]}

event: error
data: {"code":"MODEL_UNAVAILABLE","message":"暂时无法生成回复","retryable":true}
```

`activity` is optional and must contain only user-safe task status, never system prompts or hidden chain-of-thought. `done` is required once on success. Usage, performance, and citations are optional; return only real values. The client should support cancellation by aborting the request. Backend should stop generation when the client disconnects where supported.

Current `streamChatMessage` accepts `{ conversationId, text, context, mode, tool, depth, attachments }`, then invokes `onActivity`, `onChunk`, and `onComplete`. Align the pending implementation with `attachmentIds`, parse complete SSE frames (including split network chunks), handle HTTP errors, and call `onError` on failure.

## File Upload

`POST /api/chat/attachments`, multipart field `files` (repeatable). Proposed limits: backend must define max file size, total request size, page count, retention, malware scanning, and supported MIME types. Do not trust the filename or browser MIME type.

Response:

```json
{
  "files": [
    { "id": "file_123", "name": "resume.pdf", "mimeType": "application/pdf", "size": 102400, "status": "ready" }
  ]
}
```

The upload endpoint is not implemented. The current composer only stores local `File` metadata and explicitly identifies it as pending upload.

## Other Payload Shapes

- **Interview config:** `{ "position": "产品经理", "difficulty": "初级", "durationMinutes": 20, "answerMode": "text" }`.
- **Interview answer request:** `{ "questionId": "q_1", "question": "...", "answer": "...", "answerMode": "text" }`.
- **Interview feedback:** `{ "score": 4, "dimensions": [{ "name": "结构完整度", "stars": 4, "note": "..." }], "strengths": [], "suggestions": [], "starExample": "...", "relatedGuideIds": ["star"] }`.
- **Resume analysis:** `{ "text": "...", "attachmentIds": [] }`; response `{ "summary": "...", "sections": [], "suggestions": [], "jobMatches": [] }`.
- **Job match:** `{ "profile": {}, "resumeId": "file_123", "target": {} }`; response `{ "items": [{ "title": "...", "matchScore": 0.82, "reasons": [] }] }`.
- **STAR organizer:** `{ "experience": "...", "targetRole": "..." }`; response `{ "situation": "...", "task": "...", "action": "...", "result": "...", "suggestions": [] }`.
- **Chat feedback:** `{ "conversationId": "conv_123", "messageId": "msg_456", "rating": "helpful", "reason": null }`.
- **Review decision:** `{ "decision": "approved", "reason": null }`; decision is `approved` or `rejected` and must be authorized as admin.
- **Branch conversation:** create a session with `{ "title": "...", "parentSessionId": "conv_123", "branchMessageId": "msg_456" }`; the backend should preserve the selected conversation prefix or return a reference to it. Current UI copies the prefix locally and does not call the API.

These schemas are proposals. Confirm exact field names, ID ownership, privacy/retention policy, file policy, and interview media transport with the backend owner before treating them as frozen.

## Frontend Integration Status

`src/api.js` now exposes mock functions for the routes above, but that does not mean every page is wired to them. Currently the chat stream, login, and legacy interview feedback are called through the API layer. Knowledge, home recommendations, interview configuration/session lifecycle, resume analysis, admin review, user profile, and learning records still read or update local data directly. The backend integration task must first route these page operations through `src/api.js`, then replace mock implementations with HTTP calls and add loading/error/empty states.
