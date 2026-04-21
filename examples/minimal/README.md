# Minimal example

Smallest possible setup: triage only, filesystem storage, no Notion.

## Quick start

```bash
cd /path/to/chief-of-staff
pnpm install && pnpm -r build
pnpm link --global --filter @chief-of-staff/cli
pnpm link --global --filter @chief-of-staff/mcp-hub
pnpm link --global --filter @chief-of-staff/mcp-telegram

cos init
cos run triage
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

Install only the `cos-triage` skill:

```bash
ln -sf "$(pwd)/skills/cos-triage" "$HOME/.claude/skills/cos-triage"
```

That's it. You now have triage-only chief-of-staff. Run `cos run triage` and review the output at `~/.config/chief-of-staff/triage/*.json`.
