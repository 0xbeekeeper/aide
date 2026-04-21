# Install on Cursor (agent mode)

Cursor's agent mode can host chief-of-staff via its native MCP support. Skills don't auto-load the same way Claude Code does — you invoke them by prompt.

## Prerequisites

- Cursor ≥ 0.45 with agent mode enabled
- Node.js ≥ 20
- Telegram account + API creds

## 1. Build and link

```bash
git clone https://github.com/<your-fork>/chief-of-staff.git
cd chief-of-staff
pnpm install && pnpm -r build
pnpm link --global --filter @chief-of-staff/cli
pnpm link --global --filter @chief-of-staff/mcp-hub
pnpm link --global --filter @chief-of-staff/mcp-telegram
```

## 2. Add MCP servers to Cursor

Cursor Settings → **MCP** → Add server. Paste what `cos print-mcp-config cursor` emits.

You should see `chief-of-staff-hub` and `chief-of-staff-telegram` listed with green dots.

## 3. Register skills as rules

Cursor doesn't have native "skills" — instead, copy each `SKILL.md` body (minus the frontmatter) into:

- `.cursor/rules/cos-triage.md`
- `.cursor/rules/cos-reply.md`
- etc.

Or use a global rule pointing Cursor at the repo's `skills/` directory.

## 4. First login

Use the `cos` CLI outside Cursor for the one-time Telegram login:

```bash
cos init
```

## 5. Run

In Cursor's agent chat:

```
Use cos-triage to triage my Telegram inbox.
```

The agent will load the rule, call the MCP tools, and produce a triage.

## Known limitations

- Cursor does not currently schedule recurring agent runs. Use `cron` / `launchd` + `cos run <skill>` instead.
- Cursor's rule system is less discoverable than Skills — rules need to be in scope of the current project.
