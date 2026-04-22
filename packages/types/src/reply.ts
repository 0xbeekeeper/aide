export type Style = "professional" | "push" | "casual";

export interface ReplyDraft {
  id: string;
  message_id: string;
  chat_id: string;
  chat_title?: string;
  sender_name?: string;
  /** Short excerpt of the message being replied to (≤ 240 chars), verbatim in original language. */
  source_excerpt?: string;
  /** Localized version of source_excerpt when AIDE_LANG differs from the source language. Shown in cards. */
  source_excerpt_display?: string;
  /** One-paragraph summary of the 5 messages before + 5 messages after the triaged one, in AIDE_LANG. Shown on the card as 背景. */
  context_summary?: string;
  style: Style;
  text: string;
  confidence: number;
  /** One-sentence explanation of why this draft reads this way — used for auditability. */
  reasoning?: string;
  created_at: string;
  sent_at?: string;
  /** When set, this draft (or a sibling for the same message) has already been pushed to the bot as a card; push-pending must NOT push it again. Cleared only if the user explicitly re-requests. */
  pushed_at?: string;
  pushed_message_id?: number;
}
