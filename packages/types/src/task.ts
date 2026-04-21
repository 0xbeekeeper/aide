export type TaskStatus = "open" | "in_progress" | "done" | "dropped";

export interface Task {
  id: string;
  source_message_id?: string;
  source_chat_id?: string;
  action: string;
  owner?: string;
  deadline?: string;
  status: TaskStatus;
  confidence: number;
  created_at: string;
  notion_page_id?: string;
}
