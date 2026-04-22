# Minimal example

Smallest possible setup: triage only, filesystem storage, no Notion.

## Quick start

```bash
cd /path/to/aide
pnpm install && pnpm -r build
pnpm link --global --filter @aide-os/cli
pnpm link --global --filter @aide-os/mcp-hub
pnpm link --global --filter @aide-os/mcp-telegram

aide init
aide run triage
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

Install only the `aide-triage` skill:

```bash
ln -sf "$(pwd)/skills/aide-triage" "$HOME/.claude/skills/aide-triage"
```

That's it. You now have triage-only aide. Run `aide run triage` and review the output at `~/.config/aide/triage/*.json`.
