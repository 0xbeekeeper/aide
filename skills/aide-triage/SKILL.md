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

### Step 1. Fetch recent messages

Call `aide-telegram.list_unread` with:
- `since`: **start of today in the user's local timezone** (ISO 8601). Compute as today's date at 00:00:00 local time. Example: if it's 2026-04-22T14:37:00+08:00 now, pass `2026-04-22T00:00:00+08:00`. Only widen the window if the user explicitly asks (e.g. "scan last 7 days").
- `limit`: 200
- `include_read`: **true** — scan all messages in the window regardless of Telegram's read/unread state. Telegram marks messages read as soon as the user glances at them on any device, which would hide messages the user hasn't actually processed. Always prefer `include_read: true` when applying the user-profile rubric.

The response shape is `{ filter_mode, mode, messages }` — read `messages` for the array. Messages sent by the user themselves are already filtered out of `include_read` mode, so you only see counterparts' messages.

If `messages` is empty, tell the user "Inbox clear — nothing today" (or "nothing in the window") and stop.

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
7. **Language preference** — the user's preferred language is in the `AIDE_LANG` env var (`zh` = 中文, `en` = English, default `en`). Write `summary`, `reasoning`, and the final markdown summary in that language. Chat titles and sender names stay verbatim regardless of language.
8. **User profile overrides** — if the calling prompt includes a `<user_profile>…</user_profile>` block, treat the rubric inside as authoritative. In particular: the profile may define strict `needs_reply` / `priority` mappings (e.g. "private DM → needs_reply: true, priority ≥ high"; "group unrelated → ignore and do not create a triage record"). Those override the defaults in step 2 / 3 above. The profile may also define the user's role (e.g. CTO) — use it to judge what "related to me" means.

## Not in scope

- Generating reply drafts → that's `aide-reply`.
- Extracting tasks → that's `aide-task`.
- Sending messages → never, in any skill.
