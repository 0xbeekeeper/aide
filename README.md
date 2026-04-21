# chief-of-staff

> AI Chief of Staff — a framework-agnostic skill pack + MCP servers that turn any agent runtime (Claude Code, OpenCLAW, Cursor, Gemini CLI, Codex) into your personal work copilot.

**Status:** 🟡 alpha — MVP complete, needs real-world validation.

## What it does

1. **Triage** (`cos run triage`) — reads your Telegram inbox, decides what needs a reply and how urgent
2. **Reply** (`cos run reply`) — drafts 3 candidate replies per message in your voice (professional / push / casual)
3. **Task** (`cos run task`) — extracts actionable tasks, optionally syncs to Notion
4. **Brief** (`cos run brief`) — morning digest of the last 24h
5. **Style** (`cos run extract-style`) — learns your voice from your own Telegram history

## Why it's framework-agnostic

The brain is just `SKILL.md` files following the Anthropic Skills spec. The tools are MCP servers. Anything that speaks MCP + Skills can host it — no hooks, no runtime-specific primitives.

## Quick start

```bash
git clone https://github.com/<your-fork>/chief-of-staff.git
cd chief-of-staff
pnpm install && pnpm -r build

# link CLI + MCP servers onto your PATH
pnpm link --global --filter @chief-of-staff/cli
pnpm link --global --filter @chief-of-staff/mcp-hub
pnpm link --global --filter @chief-of-staff/mcp-telegram

# symlink all skills into your agent host
for s in cos-triage cos-reply cos-task cos-brief cos-style-extract; do
  ln -sf "$(pwd)/skills/$s" "$HOME/.claude/skills/$s"
done

# add MCP servers to your host's config
cos print-mcp-config claude-code   # emit snippet for ~/.claude/settings.json

# first-time setup (asks for TG_API_ID / TG_API_HASH from my.telegram.org)
cos init

# verify
cos doctor

# go
cos run extract-style    # one-time
cos run triage
cos run brief
```

Full walkthrough: [`docs/install-claude-code.md`](./docs/install-claude-code.md).

## Components

| Package | Purpose |
|---|---|
| `@chief-of-staff/types` | Shared contract (Message / Triage / ReplyDraft / Task / StyleSample / DailyBrief) |
| `@chief-of-staff/storage` | Pluggable persistence (filesystem default; swap for Notion / SQLite via `StorageAdapter`) |
| `@chief-of-staff/mcp-hub` | MCP server exposing hub CRUD (13 tools) |
| `@chief-of-staff/mcp-telegram` | MCP server wrapping gramjs user session |
| `@chief-of-staff/cli` | `cos` CLI — `init`, `run`, `doctor`, `status`, `print-mcp-config` |
| `skills/cos-*` | 5 SKILL.md files, runtime-agnostic |

## Documentation

- [Install on Claude Code](./docs/install-claude-code.md) ← start here
- [Install on OpenCLAW](./docs/install-openclaw.md)
- [Install on Cursor](./docs/install-cursor.md)
- [Architecture](./docs/architecture.md)
- [Writing custom storage adapters](./docs/custom-adapters.md)
- [Contributing](./CONTRIBUTING.md)

## Examples

- [examples/minimal](./examples/minimal) — triage only
- [examples/full](./examples/full) — all 5 skills
- [examples/notion-backed](./examples/notion-backed) — task sync to Notion

## Status & limitations

✅ Done
- Full monorepo with typed contracts
- 2 MCP servers (hub, telegram), stdio transport, 16 tools total
- 5 skills covering triage → reply → task → brief → style
- `cos` CLI with runtime auto-detection
- Docs for Claude Code / OpenCLAW / Cursor

🟡 Not yet
- End-to-end validation with a real Telegram account + 48h rolling test
- Notion storage adapter (pattern documented, not implemented)
- OpenCLAW runtime adapter in `cos` (falls back to manual instructions)
- npm package publication
- Style extraction UI / review flow

🔴 Known risks
- Telegram user session usage violates ToS if used for automation at scale. Keep this personal and low-frequency.
- Chat content is sent to your LLM — no built-in redaction yet (mentioned in skills but not enforced).
- Session string is stored at `~/.config/chief-of-staff/telegram.session` with `0600` perms — protect your machine.

## License

MIT
