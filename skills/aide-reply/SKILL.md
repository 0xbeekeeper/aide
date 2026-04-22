---
name: aide-reply
description: Generate 3 candidate reply drafts per needs-reply message in the user's voice across professional / push / casual styles. Use when the user asks to "draft replies", "write replies to pending messages", or when `aide run reply` is invoked. Consumes triage records from the hub, reads style samples, writes drafts back to the hub.
---

# aide-reply

You draft candidate replies for messages that `aide-triage` marked as `needs_reply: true`. For each such message you produce exactly **3 drafts** — one per style — and save them to the hub. You do **not** send anything.

## When to run

Triggers:
- "draft replies for my pending messages"
- "write replies"
- "reply to my inbox"
- `aide run reply`

## Required MCP tools

1. **`aide-telegram`** — `get_chat_context` (to read the thread if needed)
2. **`aide-hub`** — `list_pending`, `list_style_samples`, `save_draft`

If either is missing, stop and tell the user to run `aide doctor`.

## Workflow

### Step 1. Fetch pending triage records

Call `aide-hub.list_pending` with:
- `since`: now minus 24h
- `limit`: 30

You receive `Triage[]`. If empty, tell the user "No pending messages. Run `aide run triage` first." and stop.

### Step 2. Load style samples once

Call `aide-hub.list_style_samples` three times (or once without filter and group client-side), one per style, with `limit: 10`. Cache the result for this run.

If a style has zero samples, fall back to a **generic baseline**:
- `professional`: concise, polite, action-oriented, no emojis
- `push`: direct, firm, sets clear expectation, ≤ 2 sentences
- `casual`: friendly, lowercase-ok, emoji-ok, conversational

### Step 3. For each pending triage, build drafts

For each `Triage` record:

1. **Pull anchored thread context** — call `aide-telegram.get_chat_context` with:
   - `chat_id`: triage.chat_id
   - `anchor_message_id`: triage.message_id
   - `before`: 5
   - `after`: 5
   This returns the 5 messages before the triaged one, the triaged one itself, and up to 5 after — chronological, anchored. Use this whenever you draft, not just for ambiguous cases. It is also the source for the `context_summary` field below.

2. **Summarize context into one Chinese paragraph** (when `AIDE_LANG=zh`) — read the surrounding messages and produce a ≤3-sentence `context_summary` in Chinese that answers: "前因后果是什么？别人讨论到哪了？对方这条消息发出前的语境是什么？". Keep proper nouns verbatim. If there's not enough context (e.g. fresh thread), write a single sentence noting that. This is what the user reads under 背景 on the card.

3. **Generate 3 drafts** — produce exactly one draft per style (`professional`, `push`, `casual`). Each draft must:
   - Directly respond to the last message in the thread
   - Be in the user's voice — imitate patterns from the style samples (sentence length, punctuation, signature phrases, emoji density)
   - Be ready to send as-is — no `[placeholder]` text, no TODOs
   - Stay ≤ 280 chars unless the thread genuinely needs more
   - Match the language of the incoming message (if message is in Chinese, reply in Chinese)

4. **Set confidence** — 0.0–1.0 for each draft. Below 0.5 usually means "I don't have enough context, user should think about this one themselves."

### Step 4. Save drafts to hub

For each draft, call `aide-hub.save_draft` with the **full** schema below — `source_excerpt` and `reasoning` are **required** for auditability. The user reviews drafts via `aide drafts` and must be able to verify the AI understood the thread before copying a draft into Telegram.

```ts
{
  id: `${message_id}-${style}-${timestamp}`,  // e.g. "12345-professional-2026-04-22T..."
  message_id: triage.message_id,
  chat_id: triage.chat_id,
  chat_title: "<human-readable chat title from the triage record>",
  sender_name: "<sender display_name from the last message in the thread>",
  source_excerpt: "<≤240-char quote of the message being replied to, VERBATIM in original language>",
  source_excerpt_display: "<ALWAYS set this when AIDE_LANG is set. It is the user's reading version of what the counterpart said. If AIDE_LANG=zh, write in Chinese (translate faithfully if source was English; lightly polish if already Chinese; ≤280 chars). If AIDE_LANG=en, write in English. Keep proper nouns / usernames / product names verbatim. Strip decorative marks but keep meaning. This field is what the bot card shows — it IS the main quote the user reads.>",
  context_summary: "<From Step 2. ≤600 chars, in AIDE_LANG. One paragraph summarizing the 5 messages before + the triaged message + up to 5 after. Same `context_summary` repeated on all 3 drafts for the same message.>",
  style: "professional" | "push" | "casual",
  text: "<the draft>",
  confidence: 0.0-1.0,
  reasoning: "<ONE sentence explaining why this draft reads this way given the thread context; e.g. 'user asked ETA, I committed to Tuesday because thread shows Mike confirmed Tuesday is feasible' — write it like you're defending the draft in a review>",
  created_at: <ISO 8601 now>
}
```

**`source_excerpt_display` rationale**: the card UI shows ONLY this field. The verbatim `source_excerpt` is kept for audit but isn't displayed. Write `source_excerpt_display` as the **clearest possible one-paragraph rendering** of what the counterpart said — if the source was long/rambling, tighten it; if it was in another language, translate. Always in the user's `AIDE_LANG`.

**Rules for `reasoning`**:
- ONE sentence, ≤ 400 chars.
- Reference what you understood from the thread ("user asked X given Y context").
- If you made a judgment call, state it ("assumed they want it by Friday based on the deadline mentioned earlier").
- If confidence is < 0.8, explicitly note what you were uncertain about.
- This is the user's hallucination-detector — write honestly.

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
3. **Ack-first default — THE MOST IMPORTANT RULE.** Before drafting, identify what the counterpart is actually asking for:
   - If they are **sharing info, forwarding a link, asking for review, asking for approval, or sending hype** → the default draft is a **one-sentence acknowledgement** ("好的我看下" / "收到，晚点过" / "ok 可以发" / "🔥 let's go"). NOT instructions, NOT delegation, NOT rewriting their ask.
   - Only produce directive-heavy drafts when the counterpart **explicitly asked for a decision** ("你定一下" / "拍板" / "你觉得呢" / "which way should we go").
   - Only include delegation (@someone please do X) when the counterpart's ask actually needs to fan out to another person. A review request does not need delegation.
   - Style differentiation should live in **tone and warmth**, not in **how many commands the draft contains**. Professional / push / casual drafts for the SAME message should all be roughly the same LENGTH and SHAPE — just different registers of politeness.
   - When in doubt between "ack" and "direct": choose ack for professional + casual; push can be slightly more direct but still not bossy.
4. **Match the language of the incoming message** for the draft `text` — do not translate.
5. **`reasoning` follows `AIDE_LANG`** — the one-sentence why-explanation is for the USER, not the counterpart. Write it in the user's preferred language (`AIDE_LANG` env var: `zh` = 中文, `en` = English, default `en`). If `AIDE_LANG=zh`, write reasoning in Chinese even when the draft itself is in English.
6. **Redact sensitive content** — if the thread contains secrets, leave them out of the draft (don't echo API keys / seed phrases / private keys back).
7. **If triage.priority === "ignore" or "spam"** → skip that message entirely, don't draft.
8. **If triage.confidence < 0.5** → skip, tell the user "triage was uncertain; re-run `aide run triage` on this thread for better context."
9. **User profile overrides style defaults** — if the calling prompt includes a `<user_profile>…</user_profile>` block, treat its "Reply voice" (especially the scenario table) and "Things I do NOT want in drafts" sections as hard constraints. They trump the generic style descriptions in step 2 above.

## Not in scope

- Sending messages → manual by the user, or a future opt-in skill.
- Rewriting the user's own style samples → that's `aide-style-extract`.
- Creating tasks → that's `aide-task`.
