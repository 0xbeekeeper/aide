# Writing a custom storage adapter

Everything in aide that needs persistence goes through `StorageAdapter`. Swap the filesystem default for Notion, Postgres, SQLite, or anything else by implementing the interface.

## Interface

See `packages/storage/src/adapter.ts`. You need to implement:

```ts
interface StorageAdapter {
  saveTriage(t: Triage): Promise<void>;
  listTriage(q?: TriageQuery): Promise<Triage[]>;
  getTriage(message_id: string): Promise<Triage | null>;

  saveDraft(d: ReplyDraft): Promise<void>;
  listDrafts(message_id: string): Promise<ReplyDraft[]>;
  markDraftSent(draft_id: string, sent_at: string): Promise<void>;

  saveTask(t: Task): Promise<void>;
  listTasks(q?: TaskQuery): Promise<Task[]>;
  updateTaskStatus(task_id: string, status: TaskStatus): Promise<void>;

  saveStyleSamples(samples: StyleSample[]): Promise<void>;
  listStyleSamples(style?: Style, limit?: number): Promise<StyleSample[]>;

  saveBrief(b: DailyBrief): Promise<void>;
  getLatestBrief(): Promise<DailyBrief | null>;
}
```

## Notion adapter sketch

```ts
import type { StorageAdapter, Triage, Task } from "@aide-os/storage";
import { Client } from "@notionhq/client";

export class NotionAdapter implements StorageAdapter {
  constructor(private readonly notion: Client, private readonly dbs: {
    triage: string;
    tasks: string;
    drafts: string;
    samples: string;
    briefs: string;
  }) {}

  async saveTriage(t: Triage): Promise<void> {
    await this.notion.pages.create({
      parent: { database_id: this.dbs.triage },
      properties: {
        Name: { title: [{ text: { content: t.summary } }] },
        Priority: { select: { name: t.priority } },
        NeedsReply: { checkbox: t.needs_reply },
        // ...
      },
    });
  }
  // ...
}
```

## Wiring it into mcp-hub

`mcp-hub` accepts an optional `storage` in `createHubServer()`. Point it at your adapter:

```ts
import { createHubServer } from "@aide-os/mcp-hub";
import { NotionAdapter } from "./notion.js";

const storage = new NotionAdapter(new Client({ auth: process.env.NOTION_TOKEN! }), {
  triage: "…",
  tasks: "…",
  drafts: "…",
  samples: "…",
  briefs: "…",
});

const server = createHubServer({ storage });
// ... standard stdio transport
```

Ship this as `@aide-os/mcp-hub-notion` if you want a reusable package, or run it locally as a bespoke script.

## Guidance

- Keep `saveX` idempotent — re-saving the same id should overwrite, not duplicate.
- Implement `listX` queries loosely — exact filters are nice-to-have; just don't return _nothing_ when the filters are unrecognized.
- For cloud backends, expect cold-start latency. mcp-hub doesn't impose a timeout, but the host runtime might.
