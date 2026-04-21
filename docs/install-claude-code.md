# Install on Claude Code

This guide gets chief-of-staff running inside Claude Code in ~10 minutes.

## Prerequisites

- Node.js ≥ 20
- pnpm ≥ 10
- Claude Code installed (`claude` on your PATH)
- A Telegram account + phone number
- `TG_API_ID` and `TG_API_HASH` from https://my.telegram.org → _API development tools_

## 1. Clone and build

```bash
git clone https://github.com/<your-fork>/chief-of-staff.git
cd chief-of-staff
pnpm install
pnpm -r build
```

This builds every package and installs the `cos` CLI.

## 2. Link the CLI

For personal use, link the `cos` binary onto your PATH:

```bash
pnpm link --global --filter @chief-of-staff/cli
pnpm link --global --filter @chief-of-staff/mcp-hub
pnpm link --global --filter @chief-of-staff/mcp-telegram
```

Verify:

```bash
cos --version
which cos-mcp-hub cos-mcp-telegram
```

## 3. Install the skills

Symlink each skill directory into `~/.claude/skills/`:

```bash
for s in cos-triage cos-reply cos-task cos-brief cos-style-extract; do
  ln -sf "$(pwd)/skills/$s" "$HOME/.claude/skills/$s"
done
```

Confirm Claude Code discovers them next session — they'll appear in the skill list at session start.

## 4. Configure MCP servers

Add to `~/.claude/settings.json` (merge with any existing `mcpServers`):

```json
{
  "mcpServers": {
    "chief-of-staff-hub": {
      "command": "cos-mcp-hub"
    },
    "chief-of-staff-telegram": {
      "command": "cos-mcp-telegram",
      "env": {
        "TG_API_ID": "<your api id>",
        "TG_API_HASH": "<your api hash>"
      }
    }
  }
}
```

You can also run `cos print-mcp-config claude-code` to generate this snippet with your creds pre-filled.

## 5. First-time login

```bash
cos init
```

This:
1. Prompts for `TG_API_ID` / `TG_API_HASH` and saves them to `~/.config/chief-of-staff/.env`
2. Runs the Telegram login flow (phone → code → 2FA)
3. Saves your session string to `~/.config/chief-of-staff/telegram.session`

## 6. Verify

```bash
cos doctor
```

All 5 checks should be ✓.

## 7. First run

Cold-start your style samples (reads ~500 of your own sent messages):

```bash
cos run extract-style
```

Then triage your inbox:

```bash
cos run triage
cos run reply
cos run brief
```

## Scheduling

Claude Code's `/schedule` skill can run these on a cron. Example — triage every 15 minutes:

```bash
# inside a claude code session
/schedule "Every 15 minutes, run: cos run triage"
```

Or use system cron / launchd directly:

```cron
*/15 * * * *  /usr/local/bin/cos run triage
0    8 * * *  /usr/local/bin/cos run brief
```

## Troubleshooting

- **`cos: command not found`** — re-run `pnpm link --global --filter @chief-of-staff/cli`
- **`No Telegram session found`** — run `cos init` again
- **`MCP server 'chief-of-staff-hub' failed to start`** — make sure `cos-mcp-hub` resolves on Claude Code's PATH; add the absolute path to `command` in `settings.json` if needed
- **Telegram rate limits** — the MCP client respects gramjs's default backoff; don't hammer `list_unread` at sub-minute intervals

## Uninstall

```bash
rm "$HOME/.claude/skills/cos-"*
rm -rf "$HOME/.config/chief-of-staff"
pnpm unlink --global @chief-of-staff/cli @chief-of-staff/mcp-hub @chief-of-staff/mcp-telegram
# then remove the mcpServers entries from ~/.claude/settings.json
```
