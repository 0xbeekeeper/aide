import type {
  Triage,
  ReplyDraft,
  Task,
  StyleSample,
  DailyBrief,
  Style,
  ChatFilter,
} from "@aide-os/types";

export interface TriageQuery {
  since?: string;
  until?: string;
  needs_reply?: boolean;
  chat_id?: string;
  limit?: number;
}

export interface TaskQuery {
  status?: Task["status"];
  limit?: number;
}

export interface StorageAdapter {
  saveTriage(t: Triage): Promise<void>;
  listTriage(q?: TriageQuery): Promise<Triage[]>;
  getTriage(message_id: string): Promise<Triage | null>;

  saveDraft(d: ReplyDraft): Promise<void>;
  listDrafts(message_id: string): Promise<ReplyDraft[]>;
  markDraftSent(draft_id: string, sent_at: string): Promise<void>;

  saveTask(t: Task): Promise<void>;
  listTasks(q?: TaskQuery): Promise<Task[]>;
  updateTaskStatus(task_id: string, status: Task["status"]): Promise<void>;

  saveStyleSamples(samples: StyleSample[]): Promise<void>;
  listStyleSamples(style?: Style, limit?: number): Promise<StyleSample[]>;

  saveBrief(b: DailyBrief): Promise<void>;
  getLatestBrief(): Promise<DailyBrief | null>;

  loadChatFilter(): Promise<ChatFilter>;
  saveChatFilter(f: ChatFilter): Promise<void>;
}
