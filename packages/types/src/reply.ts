export type Style = "professional" | "push" | "casual";

export interface ReplyDraft {
  id: string;
  message_id: string;
  chat_id: string;
  style: Style;
  text: string;
  confidence: number;
  created_at: string;
  sent_at?: string;
}
