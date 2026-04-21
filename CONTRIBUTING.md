# Contributing to chief-of-staff

Thanks for your interest. This project is small and opinionated — contributions should preserve its core design principles.

## Core principles (don't break these)

1. **Framework-agnostic.** Nothing in `skills/` or `packages/` should depend on a specific agent host. If it only works on Claude Code, it doesn't belong.
2. **MCP + Skills only.** No hooks, no hidden state, no runtime-injected context.
3. **Pluggable storage.** New features should go through `StorageAdapter`, not hard-code filesystem paths.
4. **Types are the contract.** If you add a concept, extend `@chief-of-staff/types` first; then wire it into skills + hub + CLI in that order.

## Development

```bash
pnpm install
pnpm -r build
pnpm -r typecheck
```

Run a specific package in dev:

```bash
pnpm --filter @chief-of-staff/cli dev -- run triage
```

Run the mcp-hub server locally:

```bash
pnpm --filter @chief-of-staff/mcp-hub dev
```

## Adding a skill

1. Create `skills/<name>/SKILL.md` with Anthropic Skills frontmatter (`name`, `description`).
2. Reference only tools exposed by existing MCP servers (`chief-of-staff-hub`, `chief-of-staff-telegram`), or extend one.
3. Add an alias to `packages/cli/src/skills.ts` so it's runnable via `cos run <alias>`.
4. Update `README.md` and any relevant `docs/install-*.md`.

## Adding an MCP server

1. `packages/mcp-<name>/` — standard structure (package.json, tsconfig.json, src/server.ts, src/bin.ts).
2. Use `@modelcontextprotocol/sdk`'s `McpServer` and `StdioServerTransport`.
3. Input schemas via `zod`.
4. Tools should return `{ content: [{ type: "text", text: JSON.stringify(...) }] }` (wrap in a `json()` helper).
5. Add a dependency on `@chief-of-staff/types`.
6. Document the tools in `docs/architecture.md`.

## Adding a host

1. `docs/install-<host>.md` — follow the structure of `install-claude-code.md`.
2. If the host has a distinct runtime detection, extend `packages/cli/src/runtime.ts`.
3. Test with at least one skill end-to-end before submitting.

## Commit style

Descriptive, imperative. No conventional-commit enforcement but prefixes like `feat(mcp-hub):`, `fix(cli):` are welcome.

## Things we will not accept

- PRs that add runtime lock-in to a single host
- PRs that remove the filesystem storage adapter
- PRs that introduce a hosted/cloud dependency for core functionality (Telegram excepted — that's the input channel)
- Features that require the user to grant broader scopes than already documented
