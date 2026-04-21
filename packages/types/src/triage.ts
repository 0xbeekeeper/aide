export type Priority = "urgent" | "high" | "medium" | "low" | "ignore";

export type Intent =
  | "request_reply"
  | "request_decision"
  | "request_update"
  | "fyi"
  | "social"
  | "spam"
  | "other";

export interface Triage {
  message_id: string;
  chat_id: string;
  priority: Priority;
  needs_reply: boolean;
  intent: Intent;
  summary: string;
  reasoning: string;
  confidence: number;
  created_at: string;
}
