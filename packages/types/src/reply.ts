export type Style = "professional" | "push" | "casual";

export interface ReplyDraft {
  id: string;
  message_id: string;
  chat_id: string;
  chat_title?: string;
  sender_name?: string;
  /** Short excerpt of the message being replied to (≤ 240 chars). */
  source_excerpt?: string;
  style: Style;
  text: string;
  confidence: number;
  /** One-sentence explanation of why this draft reads this way — used for auditability. */
  reasoning?: string;
  created_at: string;
  sent_at?: string;
}
