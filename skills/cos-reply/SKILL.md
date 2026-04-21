---
name: cos-reply
description: Generate 3 candidate reply drafts per needs-reply message in the user's voice across professional / push / casual styles. Use when the user asks to "draft replies", "write replies to pending messages", or when `cos run reply` is invoked. Consumes triage records from the hub, reads style samples, writes drafts back to the hub.
---

# cos-reply

You draft candidate replies for messages that `cos-triage` marked as `needs_reply: true`. For each such message you produce exactly **3 drafts** — one per style — and save them to the hub. You do **not** send anything.

## When to run

Triggers:
- "draft replies for my pending messages"
- "write replies"
- "reply to my inbox"
- `cos run reply`

## Required MCP tools

1. **`chief-of-staff-telegram`** — `get_chat_context` (to read the thread if needed)
2. **`chief-of-staff-hub`** — `list_pending`, `list_style_samples`, `save_draft`

If either is missing, stop and tell the user to run `cos doctor`.

## Workflow

### Step 1. Fetch pending triage records

Call `chief-of-staff-hub.list_pending` with:
- `since`: now minus 24h
- `limit`: 30

You receive `Triage[]`. If empty, tell the user "No pending messages. Run `cos run triage` first." and stop.

### Step 2. Load style samples once

Call `chief-of-staff-hub.list_style_samples` three times (or once without filter and group client-side), one per style, with `limit: 10`. Cache the result for this run.

If a style has zero samples, fall back to a **generic baseline**:
- `professional`: concise, polite, action-oriented, no emojis
- `push`: direct, firm, sets clear expectation, ≤ 2 sentences
- `casual`: friendly, lowercase-ok, emoji-ok, conversational

### Step 3. For each pending triage, build drafts

For each `Triage` record:

1. **Pull thread context** — call `chief-of-staff-telegram.get_chat_context` with `chat_id` and `n: 5` to get the last 5 messages. Use this to understand what's being discussed and who's asking what. Skip this call if `triage.confidence >= 0.9` and the summary is unambiguous.

2. **Generate 3 drafts** — produce exactly one draft per style (`professional`, `push`, `casual`). Each draft must:
   - Directly respond to the last message in the thread
   - Be in the user's voice — imitate patterns from the style samples (sentence length, punctuation, signature phrases, emoji density)
   - Be ready to send as-is — no `[placeholder]` text, no TODOs
   - Stay ≤ 280 chars unless the thread genuinely needs more
   - Match the language of the incoming message (if message is in Chinese, reply in Chinese)

3. **Set confidence** — 0.0–1.0 for each draft. Below 0.5 usually means "I don't have enough context, user should think about this one themselves."

### Step 4. Save drafts to hub

For each draft, call `chief-of-staff-hub.save_draft` with:

```ts
{
  id: `${message_id}-${style}-${timestamp}`,  // e.g. "12345-professional-2026-04-22T..."
  message_id: triage.message_id,
  chat_id: triage.chat_id,
  style: "professional" | "push" | "casual",
  text: "<the draft>",
  confidence: 0.0-1.0,
  created_at: <ISO 8601 now>
}
```

### Step 5. Summary to user

Print a markdown summary like:

```
## Drafted replies — <N> messages, <3N> drafts

### <chat title> — <sender>
> <last-message excerpt, 80 chars>

**Professional** (conf 0.82)
<draft text>

**Push** (conf 0.71)
<draft text>

**Casual** (conf 0.88)
<draft text>
---
```

End with: `Saved <3N> drafts to the hub. Copy/paste the one you like into Telegram manually — nothing is sent automatically.`

## Rules

1. **Never call `send_message`** — this skill only drafts. Sending is a separate manual step.
2. **Never invent facts** — if you don't know the answer, say "I need more info from you" rather than guessing.
3. **Match the language of the incoming message** — do not translate.
4. **Redact sensitive content** — if the thread contains secrets, leave them out of the draft (don't echo API keys / seed phrases / private keys back).
5. **If triage.priority === "ignore" or "spam"** → skip that message entirely, don't draft.
6. **If triage.confidence < 0.5** → skip, tell the user "triage was uncertain; re-run `cos run triage` on this thread for better context."

## Not in scope

- Sending messages → manual by the user, or a future opt-in skill.
- Rewriting the user's own style samples → that's `cos-style-extract`.
- Creating tasks → that's `cos-task`.
