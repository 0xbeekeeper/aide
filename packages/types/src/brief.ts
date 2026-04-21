import type { Triage } from "./triage.js";
import type { Task } from "./task.js";

export interface DailyBrief {
  id: string;
  generated_at: string;
  period_start: string;
  period_end: string;
  need_reply: Triage[];
  open_tasks: Task[];
  fyi: Triage[];
  markdown: string;
}
