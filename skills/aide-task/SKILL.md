---
name: aide-task
description: Extract actionable tasks from recent Telegram messages and save them to the hub (optionally syncing to Notion). Use when the user asks "pull tasks from my inbox", "what do I owe people", "extract todos", or when `aide run task` is invoked.
---

# aide-task

You scan recent triage records and chat threads to extract **actionable tasks** for the user — things they committed to, things others are waiting on, things with an implied deadline. Each task is a `Task` record saved to the hub. If a Notion MCP is available, you additionally sync open tasks to the user's task database.

## When to run

Triggers:
- "extract tasks from my messages"
- "what am I on the hook for"
- "pull my todos"
- `aide run task`

## Required MCP tools

1. **`aide-hub`** — `list_triage`, `save_task`, `list_tasks`
2. **`aide-telegram`** — `get_chat_context` (for thread context when needed)
3. *(optional)* **Notion MCP** — if `Notion` tools are available, sync to the user's Notion tasks DB

If the first two are missing, stop and tell the user to run `aide doctor`.

## Workflow

### Step 1. Fetch recent triage

Call `aide-hub.list_triage` with:
- `since`: now minus 24h
- `limit`: 100

### Step 2. Deduplicate against existing tasks

Call `aide-hub.list_tasks` with `status: "open"` to get currently open tasks. Skip triage records whose `message_id` already appears in some `task.source_message_id`.

### Step 3. For each candidate, decide if it's a task

A message produces a task when it matches any of:

- **Commitment by user**: sender is self, and text contains "I'll / I will / let me / 我来 / 我去 / 我处理"
- **Request on user**: sender is someone else, and text contains a direct ask ("can you / please / could you / 能不能 / 麻烦 / 帮我")
- **Deadline mentioned**: text contains a date / "by <time>" / "before <date>" / "今天之前 / 明天前"
- **Decision required**: triage.intent === "request_decision"

When unsure, **don't create a task** — false positives pollute Notion.

### Step 4. Build Task records

For each valid candidate, produce:

```ts
{
  id: `task-${Date.now()}-${randomSuffix}`,
  source_message_id: triage.message_id,
  source_chat_id: triage.chat_id,
  action: "<one-sentence action, imperative mood, ≤ 120 chars>",
  owner: "me" | "<person-name>",   // me = user; else the counterpart
  deadline: "<ISO date if explicit; omit otherwise>",
  status: "open",
  confidence: 0.0-1.0,
  created_at: <ISO 8601 now>
}
```

**action** should read like a task title, not a paraphrase of the message:
- ✅ "Send Alex the revised pricing deck"
- ❌ "Alex asked about the deck"

### Step 5. Save to hub

For each task, call `aide-hub.save_task`.

### Step 6 (optional). Sync to Notion

If a Notion MCP is available AND the user has confirmed a tasks database (see `Notion:find` or `Notion:tasks:setup`):

1. For each open task with no `notion_page_id`, call `Notion:create-task` with the action, owner, deadline.
2. Extract the returned page_id and re-save the task via `save_task` with `notion_page_id` filled in (so next run won't duplicate).

If Notion is unavailable or unconfigured, **skip silently** — do not error.

### Step 7. Summary to user

```
## Extracted tasks — <N> new

### You owe someone (<n>)
- [ ] <action> — to <counterpart> — due <deadline?>

### Others owe you (<n>)
- [ ] <action> — from <counterpart> — due <deadline?>

### Decisions pending (<n>)
- [ ] <action>
```

End with: `Saved <N> tasks to hub.` If Notion sync ran: `Synced <K> to Notion.`

## Rules

1. **Be conservative** — when in doubt, skip. Over-extraction is worse than under-extraction.
2. **One task per message max** — if a message contains multiple asks, pick the most concrete one.
3. **No tasks for spam / FYI / social** triage records.
4. **Never delete existing tasks** in this skill — only create. Status changes happen elsewhere.
5. **Action language** — write `action` in `AIDE_LANG` (env var: `zh` = 中文, `en` = English, default `en`). This is the user's todo list, not a forward to the source thread. Keep proper nouns (people, product names) verbatim.

## Not in scope

- Closing / updating tasks — that's the user's job via Notion or `aide task close <id>`.
- Reminders — a scheduler concern, outside this skill.
- Triage — done upstream by `aide-triage`.
