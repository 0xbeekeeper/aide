# Install on Cursor (agent mode)

Cursor's agent mode can host aide via its native MCP support. Skills don't auto-load the same way Claude Code does — you invoke them by prompt.

## Prerequisites

- Cursor ≥ 0.45 with agent mode enabled
- Node.js ≥ 20
- Telegram account + API creds

## 1. Build and link

```bash
git clone https://github.com/<your-fork>/aide.git
cd aide
pnpm install && pnpm -r build
pnpm link --global --filter @aide-os/cli
pnpm link --global --filter @aide-os/mcp-hub
pnpm link --global --filter @aide-os/mcp-telegram
```

## 2. Add MCP servers to Cursor

Cursor Settings → **MCP** → Add server. Paste what `aide print-mcp-config cursor` emits.

You should see `aide-hub` and `aide-telegram` listed with green dots.

## 3. Register skills as rules

Cursor doesn't have native "skills" — instead, copy each `SKILL.md` body (minus the frontmatter) into:

- `.cursor/rules/aide-triage.md`
- `.cursor/rules/aide-reply.md`
- etc.

Or use a global rule pointing Cursor at the repo's `skills/` directory.

## 4. First login

Use the `aide` CLI outside Cursor for the one-time Telegram login:

```bash
aide init
```

## 5. Run

In Cursor's agent chat:

```
Use aide-triage to triage my Telegram inbox.
```

The agent will load the rule, call the MCP tools, and produce a triage.

## Known limitations

- Cursor does not currently schedule recurring agent runs. Use `cron` / `launchd` + `aide run <skill>` instead.
- Cursor's rule system is less discoverable than Skills — rules need to be in scope of the current project.
