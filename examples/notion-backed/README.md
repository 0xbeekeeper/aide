# Notion-backed example

Store tasks in Notion instead of (or in addition to) the filesystem. Filesystem stays as the primary store for triage / drafts / samples / briefs; Notion gets a mirror of open tasks.

## Why

- Access your tasks from any device
- Edit / close tasks via Notion UI without ever touching the CLI
- Share a subset with collaborators

## Requirements

- A Notion integration token with access to one database
- A Notion tasks database with properties:
  - `Name` (title)
  - `Status` (select: open / in_progress / done / dropped)
  - `Owner` (rich_text)
  - `Deadline` (date)
  - `Source` (url, optional — Telegram deep link)

## Wiring

chief-of-staff doesn't ship a Notion MCP of its own — use [Anthropic's Notion MCP](https://github.com/anthropics/mcp-servers) or similar. As long as `cos-task` can see `Notion:create-task` / `Notion:database-query` tools at runtime, it will sync.

### `~/.claude/settings.json`

```json
{
  "mcpServers": {
    "chief-of-staff-hub": { "command": "cos-mcp-hub" },
    "chief-of-staff-telegram": {
      "command": "cos-mcp-telegram",
      "env": { "TG_API_ID": "…", "TG_API_HASH": "…" }
    },
    "notion": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-notion"],
      "env": { "NOTION_TOKEN": "secret_…" }
    }
  }
}
```

### Tell `cos-task` which DB to write to

Create a small project memory note at `~/.claude/memory/notion-tasks-db.md`:

```
Notion tasks database id: <YOUR_DB_ID>
cos-task should call Notion:create-task targeting this database.
```

Or (cleaner) set `COS_NOTION_TASKS_DB` env var and extend the `cos-task` skill to read it.

## Run

```bash
cos run task
```

You should see:

```
Extracted tasks — 3 new
...
Saved 3 tasks to hub.
Synced 3 to Notion.
```

New rows appear in your Notion database. Each task's `notion_page_id` is stored locally so re-runs don't duplicate.
