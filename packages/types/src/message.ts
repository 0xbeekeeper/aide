export type Platform = "telegram" | "slack" | "discord" | "email" | "other";

export interface Sender {
  id: string;
  display_name: string;
  username?: string;
  is_self: boolean;
}

export interface Chat {
  id: string;
  platform: Platform;
  title: string;
  kind: "private" | "group" | "channel";
}

export interface Message {
  id: string;
  chat: Chat;
  sender: Sender;
  text: string;
  ts: string;
  reply_to_id?: string;
  is_unread: boolean;
  has_media: boolean;
  raw?: Record<string, unknown>;
}
