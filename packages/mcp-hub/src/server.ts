import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  FilesystemAdapter,
  type StorageAdapter,
} from "@aide-os/storage";
import type {
  Triage,
  ReplyDraft,
  Task,
  StyleSample,
  DailyBrief,
} from "@aide-os/types";

const PrioritySchema = z.enum(["urgent", "high", "medium", "low", "ignore"]);
const IntentSchema = z.enum([
  "request_reply",
  "request_decision",
  "request_update",
  "fyi",
  "social",
  "spam",
  "other",
]);
const StyleSchema = z.enum(["professional", "push", "casual"]);
const TaskStatusSchema = z.enum(["open", "in_progress", "done", "dropped"]);

const TriageSchema = z.object({
  message_id: z.string(),
  chat_id: z.string(),
  priority: PrioritySchema,
  needs_reply: z.boolean(),
  intent: IntentSchema,
  summary: z.string(),
  reasoning: z.string(),
  confidence: z.number().min(0).max(1),
  created_at: z.string(),
});

const ReplyDraftSchema = z.object({
  id: z.string(),
  message_id: z.string(),
  chat_id: z.string(),
  style: StyleSchema,
  text: z.string(),
  confidence: z.number().min(0).max(1),
  created_at: z.string(),
  sent_at: z.string().optional(),
});

const TaskSchema = z.object({
  id: z.string(),
  source_message_id: z.string().optional(),
  source_chat_id: z.string().optional(),
  action: z.string(),
  owner: z.string().optional(),
  deadline: z.string().optional(),
  status: TaskStatusSchema,
  confidence: z.number().min(0).max(1),
  created_at: z.string(),
  notion_page_id: z.string().optional(),
});

const StyleSampleSchema = z.object({
  id: z.string(),
  style: StyleSchema,
  text: z.string(),
  source_message_id: z.string().optional(),
  source_chat_id: z.string().optional(),
  extracted_at: z.string(),
  approved: z.boolean(),
});

const DailyBriefSchema = z.object({
  id: z.string(),
  generated_at: z.string(),
  period_start: z.string(),
  period_end: z.string(),
  need_reply: z.array(TriageSchema),
  open_tasks: z.array(TaskSchema),
  fyi: z.array(TriageSchema),
  markdown: z.string(),
});

export interface HubServerOptions {
  storage?: StorageAdapter;
  name?: string;
  version?: string;
}

function json(data: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

export function createHubServer(opts: HubServerOptions = {}): McpServer {
  const storage: StorageAdapter = opts.storage ?? new FilesystemAdapter();
  const server = new McpServer({
    name: opts.name ?? "aide-hub",
    version: opts.version ?? "0.0.0",
  });

  server.registerTool(
    "save_triage",
    {
      title: "Save Triage",
      description:
        "Persist a Triage record. Idempotent: re-saving the same message_id overwrites.",
      inputSchema: TriageSchema.shape,
    },
    async (input) => {
      await storage.saveTriage(input as Triage);
      return json({ ok: true, message_id: input.message_id });
    },
  );

  server.registerTool(
    "list_pending",
    {
      title: "List Pending Triage",
      description:
        "List triage records that still need a reply, newest first.",
      inputSchema: {
        since: z.string().optional(),
        chat_id: z.string().optional(),
        limit: z.number().int().positive().max(200).optional(),
      },
    },
    async ({ since, chat_id, limit }) => {
      const items = await storage.listTriage({
        ...(since !== undefined ? { since } : {}),
        ...(chat_id !== undefined ? { chat_id } : {}),
        needs_reply: true,
        ...(limit !== undefined ? { limit } : {}),
      });
      return json(items);
    },
  );

  server.registerTool(
    "list_triage",
    {
      title: "List Triage (all)",
      description: "List all triage records, filterable by window/chat.",
      inputSchema: {
        since: z.string().optional(),
        until: z.string().optional(),
        chat_id: z.string().optional(),
        needs_reply: z.boolean().optional(),
        limit: z.number().int().positive().max(500).optional(),
      },
    },
    async (args) => {
      const items = await storage.listTriage({
        ...(args.since !== undefined ? { since: args.since } : {}),
        ...(args.until !== undefined ? { until: args.until } : {}),
        ...(args.chat_id !== undefined ? { chat_id: args.chat_id } : {}),
        ...(args.needs_reply !== undefined
          ? { needs_reply: args.needs_reply }
          : {}),
        ...(args.limit !== undefined ? { limit: args.limit } : {}),
      });
      return json(items);
    },
  );

  server.registerTool(
    "save_draft",
    {
      title: "Save Reply Draft",
      description: "Save a candidate reply draft for a message.",
      inputSchema: ReplyDraftSchema.shape,
    },
    async (input) => {
      await storage.saveDraft(input as ReplyDraft);
      return json({ ok: true, id: input.id });
    },
  );

  server.registerTool(
    "list_drafts",
    {
      title: "List Drafts for Message",
      description: "List all saved draft replies for a given message_id.",
      inputSchema: { message_id: z.string() },
    },
    async ({ message_id }) => {
      const items = await storage.listDrafts(message_id);
      return json(items);
    },
  );

  server.registerTool(
    "mark_draft_sent",
    {
      title: "Mark Draft Sent",
      description: "Mark a specific draft as sent (records sent_at).",
      inputSchema: { draft_id: z.string(), sent_at: z.string() },
    },
    async ({ draft_id, sent_at }) => {
      await storage.markDraftSent(draft_id, sent_at);
      return json({ ok: true, draft_id });
    },
  );

  server.registerTool(
    "save_task",
    {
      title: "Save Task",
      description: "Persist a Task record (open/in_progress/done/dropped).",
      inputSchema: TaskSchema.shape,
    },
    async (input) => {
      await storage.saveTask(input as Task);
      return json({ ok: true, id: input.id });
    },
  );

  server.registerTool(
    "list_tasks",
    {
      title: "List Tasks",
      description: "List tasks, optionally filtered by status.",
      inputSchema: {
        status: TaskStatusSchema.optional(),
        limit: z.number().int().positive().max(500).optional(),
      },
    },
    async (args) => {
      const items = await storage.listTasks({
        ...(args.status !== undefined ? { status: args.status } : {}),
        ...(args.limit !== undefined ? { limit: args.limit } : {}),
      });
      return json(items);
    },
  );

  server.registerTool(
    "update_task_status",
    {
      title: "Update Task Status",
      description: "Change a task's status.",
      inputSchema: { task_id: z.string(), status: TaskStatusSchema },
    },
    async ({ task_id, status }) => {
      await storage.updateTaskStatus(task_id, status);
      return json({ ok: true, task_id, status });
    },
  );

  server.registerTool(
    "save_style_samples",
    {
      title: "Save Style Samples",
      description:
        "Persist one or more style samples (professional / push / casual).",
      inputSchema: { samples: z.array(StyleSampleSchema) },
    },
    async ({ samples }) => {
      await storage.saveStyleSamples(samples as StyleSample[]);
      return json({ ok: true, count: samples.length });
    },
  );

  server.registerTool(
    "list_style_samples",
    {
      title: "List Style Samples",
      description: "Return style samples, optionally filtered by style.",
      inputSchema: {
        style: StyleSchema.optional(),
        limit: z.number().int().positive().max(500).optional(),
      },
    },
    async ({ style, limit }) => {
      const items = await storage.listStyleSamples(style, limit);
      return json(items);
    },
  );

  server.registerTool(
    "save_brief",
    {
      title: "Save Daily Brief",
      description: "Persist a daily brief (structured + markdown).",
      inputSchema: DailyBriefSchema.shape,
    },
    async (input) => {
      await storage.saveBrief(input as DailyBrief);
      return json({ ok: true, id: input.id });
    },
  );

  server.registerTool(
    "get_latest_brief",
    {
      title: "Get Latest Brief",
      description: "Return the most recently generated daily brief.",
      inputSchema: {},
    },
    async () => {
      const brief = await storage.getLatestBrief();
      return json(brief);
    },
  );

  return server;
}
