---
name: aide-triage
description: Triage your unread Telegram messages — decide priority, intent, whether a reply is needed. Use when the user asks for an inbox scan, "what needs my attention", "triage my messages", or when `aide run triage` is invoked. Produces a structured Triage record per unread message and saves it to the hub.
---

# aide-triage

You are triaging unread messages from a communication channel (Telegram) on behalf of the user. Your goal is to produce one `Triage` record per unread message and persist it to the hub. The user will later see the triage as a prioritized list.

## When to run

Use this skill when the user says any of:
- "triage my inbox"
- "what needs my attention"
- "scan Telegram"
- "run triage"
- or when invoked programmatically by `aide run triage`.

## Required MCP tools

This skill requires two MCP servers to be configured in the host runtime:

1. **`aide-telegram`** — provides `list_unread`, `get_chat_context`.
2. **`aide-hub`** — provides `save_triage`, `list_pending`.

If either is missing, stop and tell the user to run `aide doctor` to diagnose.

## Workflow

### Step 1. Fetch unread messages

Call `aide-telegram.list_unread` with:
- `since`: now minus 24 hours (ISO 8601)
- `limit`: 50

You will receive a `Message[]` array matching the `@aide-os/types` schema.

If the array is empty, tell the user "Inbox clear — nothing unread in the last 24h" and stop.

### Step 2. For each unread message, decide

For every message produced by step 1, independently decide the following fields to produce one `Triage` object:

| Field | How to decide |
|---|---|
| `priority` | `urgent` if time-sensitive + from a known stakeholder; `high` if awaits a direct answer; `medium` if a follow-up is needed within 24h; `low` if nice-to-have; `ignore` if spam/bot/auto-notification |
| `needs_reply` | `true` if the message ends in a question, asks for a decision, or explicitly requests action from the user |
| `intent` | One of `request_reply`, `request_decision`, `request_update`, `fyi`, `social`, `spam`, `other` |
| `summary` | One-sentence, ≤ 140 chars, what the sender wants |
| `reasoning` | One-sentence why you picked this priority/intent (for audit) |
| `confidence` | 0.0–1.0 — how sure you are of the above |

**Fetch context only when needed.** If the message alone is ambiguous, call `aide-telegram.get_chat_context` with `chat_id` and `n: 10` to pull the last 10 messages in that chat before deciding. Don't fetch context by default (too expensive).

**Never call `send_message`.** This skill only reads and triages.

### Step 3. Save to hub

For each `Triage`, call `aide-hub.save_triage` with the full record. Include `created_at` as the current ISO 8601 timestamp and `message_id` matching the input.

### Step 4. Report to user

After all messages are triaged, output a markdown summary grouped by priority:

```
## Triage result — <N> unread, <timestamp>

### 🔴 Urgent (<n>)
- [<chat title>] <summary> — <sender display_name>

### 🟠 High (<n>)
- ...

### 🟡 Medium (<n>)
- ...

### ⚪ FYI / Ignore (<n>)
- ...
```

End with: "Saved <N> triage records to the hub. Next: run `aide run reply` to generate drafts."

## Output schema

Every `Triage` record must conform to the `Triage` type from `@aide-os/types`:

```ts
{
  message_id: string,
  chat_id: string,
  priority: "urgent" | "high" | "medium" | "low" | "ignore",
  needs_reply: boolean,
  intent: "request_reply" | "request_decision" | "request_update" | "fyi" | "social" | "spam" | "other",
  summary: string,
  reasoning: string,
  confidence: number,
  created_at: string  // ISO 8601
}
```

## Rules

1. **Do not read messages outside the 24h window** unless the user explicitly widens it.
2. **Do not send any message** on the user's behalf in this skill.
3. **Be conservative with `urgent`** — reserve for real time-sensitivity, not just "feels important". If confidence < 0.7, downgrade to `high`.
4. **Redact secrets in logs** — if you see an API key / seed phrase / private key in a message, replace with `[REDACTED]` in the `summary` field but keep it in the raw message that's saved (user's choice to view).
5. **Handle groups carefully** — if `chat.kind === "group"`, prioritize messages that @mention the user or reply to the user's messages; downgrade others.
6. **Stop on first error** — if an MCP tool fails, report the error to the user and do not continue. Never invent data.

## Not in scope

- Generating reply drafts → that's `aide-reply`.
- Extracting tasks → that's `aide-task`.
- Sending messages → never, in any skill.
