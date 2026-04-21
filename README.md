# chief-of-staff

> AI Chief of Staff — a framework-agnostic skill pack + MCP servers that turn any agent runtime (Claude Code, OpenCLAW, Cursor, Gemini CLI, Codex) into your personal work copilot.

**Status:** 🚧 pre-alpha, Week 0 scaffolding.

## What it does

1. **Triage** — reads your Telegram inbox, decides what needs a reply and how urgent it is
2. **Reply** — drafts 3 candidate replies per message in your voice (professional / push / casual)
3. **Task** — extracts actionable tasks and pushes them to Notion
4. **Brief** — morning digest of what happened in the last 24h

## Why it's framework-agnostic

The brain is just `SKILL.md` files. The tools are MCP servers. Anything that speaks MCP + Skills can host it.

## Components

| Package | Purpose |
|---|---|
| `@chief-of-staff/types` | Shared contract between skills and MCPs |
| `@chief-of-staff/storage` | Pluggable persistence (filesystem / notion) |
| `@chief-of-staff/mcp-telegram` | Telegram user session MCP server |
| `@chief-of-staff/mcp-hub` | Triage / task state hub MCP server |
| `@chief-of-staff/mcp-style` | Reply style sample manager MCP server |
| `@chief-of-staff/cli` | `cos` CLI — host-agnostic runtime + cron entrypoint |
| `skills/cos-triage` | Triage workflow |
| `skills/cos-reply` | Reply draft generation |
| `skills/cos-task` | Task extraction |
| `skills/cos-brief` | Daily briefing |

## Install (work in progress)

See [`docs/install-claude-code.md`](./docs/install-claude-code.md) once Week 1 ships.

## License

MIT
