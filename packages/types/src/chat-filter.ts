export type ChatFilterMode = "whitelist" | "blacklist" | "off";
export type ChatFlag = "work" | "ignore";

export interface ChatFilterEntry {
  id: string;
  title: string;
  flag: ChatFlag;
  added_at: string;
}

export interface ChatFilter {
  mode: ChatFilterMode;
  chats: ChatFilterEntry[];
}

export const DEFAULT_CHAT_FILTER: ChatFilter = {
  mode: "off",
  chats: [],
};
