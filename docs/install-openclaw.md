# Install on OpenCLAW

OpenCLAW is a community-maintained open-source agent CLI. Installation mirrors the Claude Code flow — OpenCLAW speaks the same MCP protocol and reads `SKILL.md` files with the same frontmatter.

> **Note:** OpenCLAW's config paths differ from Claude Code. If OpenCLAW changes its conventions, update this file.

## Prerequisites

Same as Claude Code:
- Node.js ≥ 20
- pnpm ≥ 10
- `openclaw` CLI on PATH
- Telegram account + `TG_API_ID` / `TG_API_HASH`

## 1. Clone, build, link

```bash
git clone https://github.com/<your-fork>/aide.git
cd aide
pnpm install && pnpm -r build
pnpm link --global --filter @aide-os/cli
pnpm link --global --filter @aide-os/mcp-hub
pnpm link --global --filter @aide-os/mcp-telegram
```

## 2. Install skills

Symlink into OpenCLAW's skills directory (typically `~/.openclaw/skills/` — check `openclaw config show`):

```bash
OPENCLAW_SKILLS="$HOME/.openclaw/skills"
mkdir -p "$OPENCLAW_SKILLS"
for s in aide-triage aide-reply aide-task aide-brief aide-style-extract; do
  ln -sf "$(pwd)/skills/$s" "$OPENCLAW_SKILLS/$s"
done
```

## 3. Configure MCP servers

OpenCLAW reads MCP config from `~/.openclaw/mcp.json` (verify with `openclaw config path mcp`). Add:

```json
{
  "mcpServers": {
    "aide-hub": { "command": "aide-mcp-hub" },
    "aide-telegram": {
      "command": "aide-mcp-telegram",
      "env": {
        "TG_API_ID": "<your api id>",
        "TG_API_HASH": "<your api hash>"
      }
    }
  }
}
```

You can also run `aide print-mcp-config openclaw` to generate this with your creds filled.

## 4. Login and run

```bash
aide init
aide doctor
aide run triage --runtime openclaw
```

If `aide` auto-detects `openclaw` on PATH first, it will use that runtime by default.

## Differences vs Claude Code

| Concern | Claude Code | OpenCLAW |
|---|---|---|
| Skill dir | `~/.claude/skills/` | `~/.openclaw/skills/` |
| MCP config | `~/.claude/settings.json` (`mcpServers`) | `~/.openclaw/mcp.json` |
| Scheduled runs | `/schedule` skill | cron / launchd |
| Runtime env | `CLAUDE_CODE_*` | `OPENCLAW_*` |

All skill content is identical — aide doesn't depend on any framework-specific primitives.
