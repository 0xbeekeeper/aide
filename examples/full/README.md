# Full example

All 5 skills, filesystem storage, optional Notion sync.

## Setup

```bash
cd /path/to/aide
pnpm install && pnpm -r build
pnpm link --global --filter @aide-os/cli
pnpm link --global --filter @aide-os/mcp-hub
pnpm link --global --filter @aide-os/mcp-telegram

# install all skills
for s in aide-triage aide-reply aide-task aide-brief aide-style-extract; do
  ln -sf "$(pwd)/skills/$s" "$HOME/.claude/skills/$s"
done

aide init
```

## Claude Code settings.json

```json
{
  "mcpServers": {
    "aide-hub": { "command": "aide-mcp-hub" },
    "aide-telegram": {
      "command": "aide-mcp-telegram",
      "env": {
        "TG_API_ID": "1234567",
        "TG_API_HASH": "abcd1234…"
      }
    }
  }
}
```

If you also want Notion task sync, add your Notion MCP (unchanged — use whatever you already have configured).

## Daily workflow

```bash
# one-time, at onboarding
aide run extract-style

# morning
aide run brief

# every 15 min (put in cron)
aide run triage

# when you want drafts
aide run reply

# when you want your todos updated
aide run task
```

## Cron (macOS / linux)

```cron
*/15 * * * *  aide run triage
0 8 * * *     aide run brief
0 */4 * * *   aide run task
```

## Hub output

Check `~/.config/aide/`:

- `triage/*.json` — per-message decisions
- `drafts/<message_id>/*.json` — candidate replies
- `tasks/*.json` — extracted action items
- `styles/<style>/*.json` — your voice samples
- `briefs/*.md` — daily summaries
