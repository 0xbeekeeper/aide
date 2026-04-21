# Architecture

chief-of-staff is deliberately split into three independent concerns:

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
    │  cos-triage       │  │  @chief-of-staff/      │
    │  cos-reply        │  │    mcp-hub             │
    │  cos-task         │  │    mcp-telegram        │
    │  cos-brief        │  │                        │
    │  cos-style-extract│  │                        │
    └───────────────────┘  └────────────────────────┘
                │                     │
                │                     ▼
                │         ┌────────────────────────┐
                │         │ @chief-of-staff/       │
                │         │   storage              │
                │         │                        │
                │         │ FilesystemAdapter      │
                │         │ (default — ~/.config)  │
                │         └────────────────────────┘
                ▼
    ┌────────────────────┐
    │ @chief-of-staff/   │
    │   types            │ ← single source of truth for all schemas
    └────────────────────┘
```

## Principles

1. **MCP + Skills only** — we don't use Claude Code hooks, CronCreate, or any host-specific primitive. Scheduling is externalized (cron / launchd).
2. **Shared schema** — everything shaped by `@chief-of-staff/types`. Any component can be swapped out as long as it respects the types.
3. **Pluggable storage** — `StorageAdapter` interface. Default = filesystem at `~/.config/chief-of-staff/`. Future = Notion, Postgres, whatever.
4. **Bring-your-own-host** — the agent runtime is never installed by us. Users keep their existing Claude Code / OpenCLAW / Cursor.

## Package layout

| Package | Purpose | Depends on |
|---|---|---|
| `@chief-of-staff/types` | Type contract | — |
| `@chief-of-staff/storage` | Adapter interface + filesystem impl | types |
| `@chief-of-staff/mcp-hub` | MCP server exposing storage CRUD | storage, types |
| `@chief-of-staff/mcp-telegram` | MCP server wrapping gramjs user session | types |
| `@chief-of-staff/cli` (`cos`) | `init`, `run`, `doctor`, `status` | all of the above |

## Data flow (triage)

```
user invokes `cos run triage`
    │
    ▼
cos detects runtime → spawns `claude -p "... cos-triage ..."`
    │
    ▼
claude loads cos-triage/SKILL.md (auto-discovered)
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

Storage lives at `~/.config/chief-of-staff/`:

```
~/.config/chief-of-staff/
├── .env                    # TG_API_ID, TG_API_HASH
├── telegram.session        # gramjs StringSession
├── triage/<message_id>.json
├── drafts/<message_id>/<draft_id>.json
├── tasks/<task_id>.json
├── styles/<style>/<sample_id>.json
└── briefs/<brief_id>.json + .md
```

## Extending

- **New input channel** (Slack / Discord / email): add a new MCP server (`@chief-of-staff/mcp-slack`, etc.) exposing the same `Message` shape. All downstream skills keep working.
- **Different storage backend**: implement `StorageAdapter`, configure via `COS_STORAGE=...`. Example: Notion-backed hub for multi-device access.
- **New skills**: add `skills/<name>/SKILL.md`. If it needs new tools, extend mcp-hub or ship a separate MCP package.
