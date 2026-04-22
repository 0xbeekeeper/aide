# Architecture

aide is deliberately split into three independent concerns:

```
┌──────────────────────────────────────────────────────────────┐
│           Any MCP-capable Agent Runtime (the "host")          │
│                                                                │
│       Claude Code · OpenCLAW · Cursor · Gemini CLI · Codex     │
└──────────────────────────────────────────────────────────────┘
                │                   │
                │ skills (prompts)  │ MCP protocol (tools)
                ▼                   ▼
    ┌───────────────────┐  ┌────────────────────────┐
    │   skills/         │  │  MCP servers           │
    │                   │  │                        │
    │  aide-triage       │  │  @aide-os/      │
    │  aide-reply        │  │    mcp-hub             │
    │  aide-task         │  │    mcp-telegram        │
    │  aide-brief        │  │                        │
    │  aide-style-extract│  │                        │
    └───────────────────┘  └────────────────────────┘
                │                     │
                │                     ▼
                │         ┌────────────────────────┐
                │         │ @aide-os/       │
                │         │   storage              │
                │         │                        │
                │         │ FilesystemAdapter      │
                │         │ (default — ~/.config)  │
                │         └────────────────────────┘
                ▼
    ┌────────────────────┐
    │ @aide-os/   │
    │   types            │ ← single source of truth for all schemas
    └────────────────────┘
```

## Principles

1. **MCP + Skills only** — we don't use Claude Code hooks, CronCreate, or any host-specific primitive. Scheduling is externalized (cron / launchd).
2. **Shared schema** — everything shaped by `@aide-os/types`. Any component can be swapped out as long as it respects the types.
3. **Pluggable storage** — `StorageAdapter` interface. Default = filesystem at `~/.config/aide/`. Future = Notion, Postgres, whatever.
4. **Bring-your-own-host** — the agent runtime is never installed by us. Users keep their existing Claude Code / OpenCLAW / Cursor.

## Package layout

| Package | Purpose | Depends on |
|---|---|---|
| `@aide-os/types` | Type contract | — |
| `@aide-os/storage` | Adapter interface + filesystem impl | types |
| `@aide-os/mcp-hub` | MCP server exposing storage CRUD | storage, types |
| `@aide-os/mcp-telegram` | MCP server wrapping gramjs user session | types |
| `@aide-os/cli` (`aide`) | `init`, `run`, `doctor`, `status` | all of the above |

## Data flow (triage)

```
user invokes `aide run triage`
    │
    ▼
aide detects runtime → spawns `claude -p "... aide-triage ..."`
    │
    ▼
claude loads aide-triage/SKILL.md (auto-discovered)
    │
    ▼
skill calls mcp-telegram.list_unread → Message[]
    │
    ▼
LLM produces Triage record per message
    │
    ▼
skill calls mcp-hub.save_triage for each
    │
    ▼
skill prints summary to user
```

Storage lives at `~/.config/aide/`:

```
~/.config/aide/
├── .env                    # TG_API_ID, TG_API_HASH
├── telegram.session        # gramjs StringSession
├── triage/<message_id>.json
├── drafts/<message_id>/<draft_id>.json
├── tasks/<task_id>.json
├── styles/<style>/<sample_id>.json
└── briefs/<brief_id>.json + .md
```

## Extending

- **New input channel** (Slack / Discord / email): add a new MCP server (`@aide-os/mcp-slack`, etc.) exposing the same `Message` shape. All downstream skills keep working.
- **Different storage backend**: implement `StorageAdapter`, configure via `AIDE_STORAGE=...`. Example: Notion-backed hub for multi-device access.
- **New skills**: add `skills/<name>/SKILL.md`. If it needs new tools, extend mcp-hub or ship a separate MCP package.
