---
name: cos-brief
description: Generate a daily briefing markdown aggregating the last 24 hours of triage results and open tasks. Use when the user asks "give me a morning brief", "what's on my plate today", "daily rundown", or when `cos run brief` is invoked.
---

# cos-brief

You produce a **daily briefing** — a single markdown document summarizing what happened in the last 24 hours across the user's communication channels, plus their current open tasks. The brief is saved to the hub and printed to the user.

## When to run

Triggers:
- "give me a brief"
- "morning rundown"
- "what's on my plate"
- `cos run brief`

Typically run once per morning (via cron / launchd / CronCreate), but can be run ad-hoc.

## Required MCP tools

1. **`chief-of-staff-hub`** — `list_triage`, `list_tasks`, `save_brief`

If missing, stop and tell the user to run `cos doctor`.

## Workflow

### Step 1. Define period

- `period_end` = now (ISO 8601)
- `period_start` = now − 24h

### Step 2. Fetch data

In parallel if the host supports it:

1. `hub.list_triage` with `since: period_start`, `limit: 200` → bucket into:
   - `need_reply` = triage where `needs_reply === true` AND `priority !== "ignore"`
   - `fyi` = everything else whose `priority` is not `ignore` or `spam`

2. `hub.list_tasks` with `status: "open"` → `open_tasks`

### Step 3. Build the markdown brief

Template — fill the sections; do not add extra sections:

```markdown
# Daily Brief — <YYYY-MM-DD, user's local date>

Period: last 24h ending <ISO period_end>.

## 🔴 Needs your reply (<N>)
For each need_reply triage, one bullet:
- **<chat title>** — <sender display_name> — <priority emoji>
  > <summary>

Sort: urgent > high > medium > low. Cap at 10; if more, add "…and <k> more — see `cos run triage`".

## ✅ Open tasks (<N>)
For each open task, one bullet:
- [ ] <action> — owner: <owner> — <deadline? or "no deadline">

Sort: tasks with a deadline first (soonest first), then no-deadline tasks by created_at desc. Cap at 10.

## ℹ️ FYI (<N>)
For each fyi triage, one terse bullet (one line):
- <chat title>: <summary>

Cap at 5.

## Suggested focus
A 2-3 sentence paragraph synthesizing the above — what the user should tackle first this morning. Be specific (name the thread / person). Do not hedge with "you might want to consider".
```

**Priority emojis:**
- `urgent` → 🔴
- `high` → 🟠
- `medium` → 🟡
- `low` → ⚪

### Step 4. Save the brief

Call `chief-of-staff-hub.save_brief` with a `DailyBrief`:

```ts
{
  id: `brief-${period_end}`,
  generated_at: <ISO now>,
  period_start,
  period_end,
  need_reply: <Triage[]>,
  open_tasks: <Task[]>,
  fyi: <Triage[]>,
  markdown: <the markdown you generated>
}
```

### Step 5. Print to user

Print the markdown exactly as generated. Do not add preamble or postscript.

## Rules

1. **No speculation** — only report what's in the hub. If something is missing, say so explicitly ("no triage in the last 24h — run `cos run triage`").
2. **No duplication** — a message that's in `need_reply` must not also be in `fyi`.
3. **Keep it skimmable** — the whole brief should fit on one screen. Trim aggressively.
4. **Time zones** — use the user's local date in the H1 but ISO 8601 in the period line.
5. **Idempotent** — running twice in a day should overwrite the earlier brief (same `id` pattern).

## Not in scope

- Drafting replies → `cos-reply`.
- Extracting new tasks → `cos-task`.
- Pulling Telegram directly → this skill only reads from the hub.
