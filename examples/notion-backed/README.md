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

aide doesn't ship a Notion MCP of its own — use [Anthropic's Notion MCP](https://github.com/anthropics/mcp-servers) or similar. As long as `aide-task` can see `Notion:create-task` / `Notion:database-query` tools at runtime, it will sync.

### `~/.claude/settings.json`

```json
{
  "mcpServers": {
    "aide-hub": { "command": "aide-mcp-hub" },
    "aide-telegram": {
      "command": "aide-mcp-telegram",
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

### Tell `aide-task` which DB to write to

Create a small project memory note at `~/.claude/memory/notion-tasks-db.md`:

```
Notion tasks database id: <YOUR_DB_ID>
aide-task should call Notion:create-task targeting this database.
```

Or (cleaner) set `AIDE_NOTION_TASKS_DB` env var and extend the `aide-task` skill to read it.

## Run

```bash
aide run task
```

You should see:

```
Extracted tasks — 3 new
...
Saved 3 tasks to hub.
Synced 3 to Notion.
```

New rows appear in your Notion database. Each task's `notion_page_id` is stored locally so re-runs don't duplicate.
