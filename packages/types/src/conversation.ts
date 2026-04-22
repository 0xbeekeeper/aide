export interface CardConversationTurn {
  role: "user" | "assistant";
  text: string;
  ts: string;
}

export interface CardConversation {
  /** message_id of the source message whose card this conversation is about */
  id: string;
  chat_id: string;
  chat_title?: string;
  sender_name?: string;
  turns: CardConversationTurn[];
  created_at: string;
  updated_at: string;
}
