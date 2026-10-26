/** Client-safe, data-only protocol. No HTML, links, styles, or executable actions. */
export type CareerUIType = "job-match" | "resume-review" | "interview-feedback" | "action-plan" | "application-tracker";
export type CareerUIStatus = "strength" | "gap" | "unknown" | "todo" | "doing" | "done";
export interface CareerUIItem {
  id: string;
  title: string;
  description?: string;
  status?: CareerUIStatus;
  evidence?: string;
  before?: string;
  after?: string;
  score?: number;
  maxScore?: number;
}
export interface CareerUIAction { label: string; prompt: string }
export interface CareerUIData {
  version: 1;
  type: CareerUIType;
  title: string;
  summary?: string;
  items: CareerUIItem[];
  actions?: CareerUIAction[];
}
export type CareerUISegment = { kind: "text"; text: string } | { kind: "ui"; data: CareerUIData };
export interface CareerUIParseResult { segments: CareerUISegment[]; pending: boolean }

const TYPES: readonly string[] = ["job-match", "resume-review", "interview-feedback", "action-plan", "application-tracker"];
const STATUSES: readonly string[] = ["strength", "gap", "unknown", "todo", "doing", "done"];
const MAX_JSON = 64_000;
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function keys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}
function text(value: unknown, max: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value);
}
function optionalText(value: unknown, max: number): boolean { return value === undefined || text(value, max); }
function validData(value: unknown): value is CareerUIData {
  if (!record(value) || !keys(value, ["version", "type", "title", "summary", "items", "actions"]) || value.version !== 1 || !TYPES.includes(value.type as string) || !text(value.title, 160) || !optionalText(value.summary, 2000)) return false;
  if (!Array.isArray(value.items) || value.items.length > 20) return false;
  const ids = new Set<string>();
  for (const item of value.items) {
    if (!record(item) || !keys(item, ["id", "title", "description", "status", "evidence", "before", "after", "score", "maxScore"]) || !text(item.id, 80) || !text(item.title, 160)) return false;
    if (ids.has(item.id)) return false;
    ids.add(item.id);
    if (!["description", "evidence", "before", "after"].every((key) => optionalText(item[key], 4000))) return false;
    if (item.status !== undefined && !STATUSES.includes(item.status as string)) return false;
    if (item.score !== undefined && (typeof item.score !== "number" || !Number.isFinite(item.score) || item.score < 0 || item.score > 1_000_000)) return false;
    if (item.maxScore !== undefined && (typeof item.maxScore !== "number" || !Number.isFinite(item.maxScore) || item.maxScore <= 0 || item.maxScore > 1_000_000)) return false;
    if (typeof item.score === "number" && typeof item.maxScore === "number" && item.score > item.maxScore) return false;
  }
  if (value.actions !== undefined) {
    if (!Array.isArray(value.actions) || value.actions.length > 4) return false;
    if (!value.actions.every((action) => record(action) && keys(action, ["label", "prompt"]) && text(action.label, 80) && text(action.prompt, 2000))) return false;
  }
  return true;
}

/**
 * Only standalone, top-level triple-backtick minos-ui fences are interpreted.
 * Invalid complete blocks round-trip verbatim. An unfinished protocol block is
 * hidden while streaming; callers show a preparing indicator when pending=true.
 * Ordinary Markdown fences (including examples containing the protocol) stay text.
 */
export function parseCareerUI(source: string): CareerUIParseResult {
  const segments: CareerUISegment[] = [];
  const appendText = (value: string) => {
    if (!value) return;
    const previous = segments[segments.length - 1];
    if (previous?.kind === "text") previous.text += value;
    else segments.push({ kind: "text", text: value });
  };
  const lines = /(^|\n)( {0,3})(`{3,}|~{3,})([^\r\n]*)(?:\r?\n|$)/g;
  let ordinary: { char: string; length: number } | undefined;
  let block: { start: number; body: number } | undefined;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = lines.exec(source)) !== null) {
    const marker = match[3];
    const info = match[4].trim();
    const start = match.index + match[1].length;
    // Keep the newline available to the next match (adjacent fence lines).
    const end = lines.lastIndex;
    if (source[end - 1] === "\n") lines.lastIndex = end - 1;
    if (block) {
      if (marker !== "```" || info !== "") continue;
      const raw = source.slice(block.body, start);
      let data: unknown;
      try { data = raw.length <= MAX_JSON ? JSON.parse(raw) : undefined; } catch { /* textual fallback */ }
      appendText(source.slice(cursor, block.start));
      if (validData(data)) segments.push({ kind: "ui", data });
      else appendText(source.slice(block.start, end));
      cursor = end;
      block = undefined;
      continue;
    }
    if (ordinary) {
      if (marker[0] === ordinary.char && marker.length >= ordinary.length && info === "") ordinary = undefined;
      continue;
    }
    if (marker === "```" && info === "minos-ui") {
      block = { start, body: end };
    } else {
      ordinary = { char: marker[0], length: marker.length };
    }
  }
  if (block) {
    appendText(source.slice(cursor, block.start));
    return { segments, pending: true };
  }
  appendText(source.slice(cursor));
  return { segments, pending: false };
}
