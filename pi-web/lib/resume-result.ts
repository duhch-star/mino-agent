import type { AgentMessage, ToolResultMessage } from "./types";

export interface ResumeChange { field: string; before: string; after: string }
export interface ResumeResult {
  toolCallId: string;
  revision: number;
  previousRevision?: number;
  changes?: ResumeChange[];
  pdfPath?: string;
  compileError?: string;
  warnings: string[];
}
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);

/** Only actual successful bridge results, never assistant-authored suggestions. */
export function getResumeResult(message: AgentMessage): ResumeResult | null {
  if (message.role !== "toolResult" || message.isError) return null;
  const tool = message as ToolResultMessage;
  const details = tool.details;
  if (!record(details) || details.kind !== "minos-resume" || !record(details.result)) return null;
  const value = details.result;
  if (typeof value.revision !== "number" || !Number.isSafeInteger(value.revision) || value.revision < 0) return null;
  const changes = Array.isArray(value.changes) ? value.changes.filter((item): item is ResumeChange => record(item) && typeof item.field === "string" && typeof item.before === "string" && typeof item.after === "string") : undefined;
  const pdfPath = typeof value.pdfPath === "string" && /^(?:[a-zA-Z]:[\\/]|\/)/.test(value.pdfPath) && value.pdfPath.endsWith(".pdf") ? value.pdfPath : undefined;
  const compileError = typeof value.compileError === "string" ? value.compileError : undefined;
  if (!changes && !pdfPath && !compileError) return null;
  return {
    toolCallId: tool.toolCallId, revision: value.revision,
    previousRevision: typeof value.previousRevision === "number" && Number.isSafeInteger(value.previousRevision) && value.previousRevision >= 0 ? value.previousRevision : undefined,
    changes, pdfPath, compileError,
    warnings: Array.isArray(value.warnings) ? value.warnings.filter((item): item is string => typeof item === "string") : [],
  };
}

/** Consume every new result but open only the latest PDF in a batched update. */
export function consumeResumePreviews(messages: AgentMessage[], seen: Set<string>): string | undefined {
  let path: string | undefined;
  for (const message of messages) {
    const result = getResumeResult(message);
    if (!result || seen.has(result.toolCallId)) continue;
    seen.add(result.toolCallId);
    if (result.pdfPath) path = result.pdfPath;
  }
  return path;
}
