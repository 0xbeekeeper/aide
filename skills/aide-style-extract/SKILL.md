---
name: aide-style-extract
description: Extract reply style samples from the user's own Telegram sent history and classify them into professional / push / casual buckets. Use on first-time setup or when the user asks to "re-learn my style", "refresh style samples", or when `aide run extract-style` is invoked.
---

# aide-style-extract

You cold-start the reply engine by pulling the user's own sent messages from Telegram, classifying each into one of three styles (`professional`, `push`, `casual`), and saving them as `StyleSample` records. These samples are later used by `aide-reply` to imitate the user's voice.

This skill runs **once** at onboarding, plus occasionally when the user wants to refresh.

## When to run

Triggers:
- First-time setup (called by `aide init` or explicitly)
- "re-learn my style"
- "refresh style samples"
- `aide run extract-style`

## Required MCP tools

1. **`aide-telegram`** — `list_history` with `from_self: true`
2. **`aide-hub`** — `save_style_samples`, `count_samples` via `list_style_samples`

If missing, stop and tell the user to run `aide doctor`.

## Workflow

### Step 1. Confirm scope with user

Ask the user: "I'm about to read up to **500** of your own sent messages from the last **90 days** to learn your style. OK?" If the user says no or asks for a smaller set, adjust `limit` / `since` accordingly.

### Step 2. Pull sent history

Call `aide-telegram.list_history` with:
- `from_self: true`
- `since`: now − 90 days
- `limit`: 500

You get `Message[]` where every `sender.is_self === true`.

### Step 3. Clean the set

Drop messages that:
- are empty or only whitespace
- are shorter than 10 chars (too short to learn style)
- are only emojis / stickers (has_media === true and text === "")
- are only links / forwards
- contain obvious secrets (looks like API key, seed phrase, wallet address of length > 30 — regex filter)

Aim for ~200-300 quality messages.

### Step 4. Classify each into one style

For each kept message, classify by reading the **text alone** (no thread context — we're studying the user's writing patterns):

| Style | Signals |
|---|---|
| **professional** | business tone, complete sentences, minimal emoji, proper capitalization, signatures, formal greetings, "please / thanks / kindly" |
| **push** | direct, short, imperative, no softeners, urgency markers like "ASAP / 现在 / 立刻 / now", ≤ 2 sentences, sometimes confrontational |
| **casual** | lowercase, slang, emoji, abbreviations, incomplete sentences, banter, friend-coded, bilingual code-switching |

When a message fits multiple styles, pick the **dominant** one. When truly ambiguous (≤ 50% confidence), skip — do not force classification.

Target ~10-30 samples per style. If any style has < 5 samples after classification, tell the user "low sample count for <style> — `aide-reply` will fall back to generic baseline for that style."

### Step 5. Build StyleSample records

For each classified message:

```ts
{
  id: `style-${message_id}`,
  style: "professional" | "push" | "casual",
  text: <message.text verbatim, truncated to 500 chars>,
  source_message_id: message.id,
  source_chat_id: message.chat.id,
  extracted_at: <ISO now>,
  approved: false    // user will review via `aide style review`
}
```

### Step 6. Save

Call `aide-hub.save_style_samples` with the entire array in one call.

### Step 7. Summary

```
## Style extraction complete

- professional: <N> samples
- push: <N> samples
- casual: <N> samples

Total: <N> samples saved, approved=false (pending review).

Next: run `aide style review` to approve / edit samples, or `aide run reply` to try them out as-is.
```

## Rules

1. **Only pull user's own sent messages** (`from_self: true`). Never train on anyone else's writing.
2. **Never send any message** in this skill.
3. **Redact aggressively** — if a message contains a secret, drop it from samples entirely. Better to lose a sample than leak a key.
4. **Don't classify with low confidence** — skip > force.
5. **Don't re-extract unless asked** — this skill should be idempotent by message_id (save_style_samples overwrites on same id).

## Not in scope

- Drafting replies → `aide-reply`.
- Triage or task extraction → separate skills.
- Sample curation UI → CLI will add `aide style review` in a later phase.
