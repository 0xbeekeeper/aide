# Install on Claude Code

This guide gets aide running inside Claude Code in ~10 minutes.

## Prerequisites

- Node.js ≥ 20
- pnpm ≥ 10
- Claude Code installed (`claude` on your PATH)
- A Telegram account + phone number
- `TG_API_ID` and `TG_API_HASH` from https://my.telegram.org → _API development tools_

## 1. Clone and build

```bash
git clone https://github.com/<your-fork>/aide.git
cd aide
pnpm install
pnpm -r build
```

This builds every package and installs the `aide` CLI.

## 2. Link the CLI

For personal use, link the `aide` binary onto your PATH:

```bash
pnpm link --global --filter @aide-os/cli
pnpm link --global --filter @aide-os/mcp-hub
pnpm link --global --filter @aide-os/mcp-telegram
```

Verify:

```bash
aide --version
which aide-mcp-hub aide-mcp-telegram
```

## 3. Install the skills

Symlink each skill directory into `~/.claude/skills/`:

```bash
for s in aide-triage aide-reply aide-task aide-brief aide-style-extract; do
  ln -sf "$(pwd)/skills/$s" "$HOME/.claude/skills/$s"
done
```

Confirm Claude Code discovers them next session — they'll appear in the skill list at session start.

## 4. Configure MCP servers

Add to `~/.claude/settings.json` (merge with any existing `mcpServers`):

```json
{
  "mcpServers": {
    "aide-hub": {
      "command": "aide-mcp-hub"
    },
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

You can also run `aide print-mcp-config claude-code` to generate this snippet with your creds pre-filled.

## 5. First-time login

```bash
aide init
```

This:
1. Prompts for `TG_API_ID` / `TG_API_HASH` and saves them to `~/.config/aide/.env`
2. Runs the Telegram login flow (phone → code → 2FA)
3. Saves your session string to `~/.config/aide/telegram.session`

## 6. Verify

```bash
aide doctor
```

All 5 checks should be ✓.

## 7. First run

Cold-start your style samples (reads ~500 of your own sent messages):

```bash
aide run extract-style
```

Then triage your inbox:

```bash
aide run triage
aide run reply
aide run brief
```

## Scheduling

Claude Code's `/schedule` skill can run these on a cron. Example — triage every 15 minutes:

```bash
# inside a claude code session
/schedule "Every 15 minutes, run: aide run triage"
```

Or use system cron / launchd directly:

```cron
*/15 * * * *  /usr/local/bin/aide run triage
0    8 * * *  /usr/local/bin/aide run brief
```

## Troubleshooting

- **`aide: command not found`** — re-run `pnpm link --global --filter @aide-os/cli`
- **`No Telegram session found`** — run `aide init` again
- **`MCP server 'aide-hub' failed to start`** — make sure `aide-mcp-hub` resolves on Claude Code's PATH; add the absolute path to `command` in `settings.json` if needed
- **Telegram rate limits** — the MCP client respects gramjs's default backoff; don't hammer `list_unread` at sub-minute intervals

## Uninstall

```bash
rm "$HOME/.claude/skills/aide-"*
rm -rf "$HOME/.config/aide"
pnpm unlink --global @aide-os/cli @aide-os/mcp-hub @aide-os/mcp-telegram
# then remove the mcpServers entries from ~/.claude/settings.json
```
