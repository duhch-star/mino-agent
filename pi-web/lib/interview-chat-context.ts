// Browser memory only: model identity and cwd, never credentials or transcript.
export type InterviewChatContext = { model: { provider: string; modelId: string } | null; cwd: string | null };
let context: InterviewChatContext | null = null;
export function setInterviewChatContext(value: InterviewChatContext | null) { context = value; }
export function getInterviewChatContext() { return context; }
