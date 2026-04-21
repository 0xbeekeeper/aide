# Full example

All 5 skills, filesystem storage, optional Notion sync.

## Setup

```bash
cd /path/to/chief-of-staff
pnpm install && pnpm -r build
pnpm link --global --filter @chief-of-staff/cli
pnpm link --global --filter @chief-of-staff/mcp-hub
pnpm link --global --filter @chief-of-staff/mcp-telegram

# install all skills
for s in cos-triage cos-reply cos-task cos-brief cos-style-extract; do
  ln -sf "$(pwd)/skills/$s" "$HOME/.claude/skills/$s"
done

cos init
```

## Claude Code settings.json

```json
{
  "mcpServers": {
    "chief-of-staff-hub": { "command": "cos-mcp-hub" },
    "chief-of-staff-telegram": {
      "command": "cos-mcp-telegram",
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
cos run extract-style

# morning
cos run brief

# every 15 min (put in cron)
cos run triage

# when you want drafts
cos run reply

# when you want your todos updated
cos run task
```

## Cron (macOS / linux)

```cron
*/15 * * * *  cos run triage
0 8 * * *     cos run brief
0 */4 * * *   cos run task
```

## Hub output

Check `~/.config/chief-of-staff/`:

- `triage/*.json` — per-message decisions
- `drafts/<message_id>/*.json` — candidate replies
- `tasks/*.json` — extracted action items
- `styles/<style>/*.json` — your voice samples
- `briefs/*.md` — daily summaries
