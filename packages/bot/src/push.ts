import type { Bot } from "grammy";
import { FilesystemAdapter } from "@aide-os/storage";
import type { ReplyDraft } from "@aide-os/types";
import { cardKeyboard, renderCard } from "./card.js";
import { readConfig } from "./config.js";
import { getClient, resolveEntity } from "@aide-os/mcp-telegram";

/**
 * Push a single draft card to the bot owner. Returns the message_id on TG side
 * so we can edit-in-place later (on cycle/skip).
 */
export async function pushDraftCard(
  bot: Bot,
  draft: ReplyDraft,
  allDrafts: ReplyDraft[],
): Promise<number> {
  const cfg = await readConfig();
  if (!cfg) throw new Error("bot config missing — run `aide bot setup` first");

  const storage = new FilesystemAdapter();
  const triage = await storage.getTriage(draft.message_id);

  const text = renderCard(draft, triage ?? undefined, allDrafts);
  const keyboard = cardKeyboard(draft);

  const sent = await bot.api.sendMessage(cfg.owner_chat_id, text, {
    parse_mode: "HTML",
    reply_markup: keyboard,
    link_preview_options: { is_disabled: true },
  });
  return sent.message_id;
}

/**
 * Check Telegram to see whether the user has already replied to the source
 * message of this draft (self sent any message in the chat after the triaged
 * message's timestamp). If so, mark all drafts for that message as auto-sent
 * and return true.
 */
async function autoSyncIfReplied(
  chatId: string,
  messageId: string,
  drafts: ReplyDraft[],
): Promise<boolean> {
  try {
    const client = await getClient();
    const entity = await resolveEntity(client, chatId);
    const me = await client.getMe();
    const selfId = String((me as { id: unknown }).id ?? "");

    // Pull a small tail of messages and see whether any newer self message
    // exists after the triaged one.
    const tail = await client.getMessages(entity, { limit: 50 });
    const triagedNum = Number(messageId);
    let replied = false;
    for (const m of tail) {
      if (!m || m.id === undefined) continue;
      if (typeof m.id !== "number") continue;
      if (m.id <= triagedNum) continue;
      if (m.senderId && String(m.senderId) === selfId) {
        replied = true;
        break;
      }
    }
    if (!replied) return false;

    const storage = new FilesystemAdapter();
    const stamp = `auto-detected-reply:${new Date().toISOString()}`;
    for (const d of drafts) {
      if (d.sent_at) continue;
      await storage.markDraftSent(d.id, stamp);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Push every pending draft (highest-confidence per message) to the owner.
 * Skips drafts whose source message has already been sent, pushed (still
 * waiting for user action), or the user has already replied to outside the
 * bot. Returns { pushed, skipped, auto_resolved } counts.
 */
export async function pushAllPending(
  bot: Bot,
): Promise<{ pushed: number; skipped: number; auto_resolved: number }> {
  const storage = new FilesystemAdapter();
  const triages = await storage.listTriage({ needs_reply: true });
  let pushed = 0;
  let skipped = 0;
  let autoResolved = 0;
  for (const t of triages) {
    const drafts = await storage.listDrafts(t.message_id);
    if (drafts.length === 0) {
      skipped++;
      continue;
    }
    // Already sent: nothing to do.
    if (drafts.some((d) => d.sent_at)) {
      skipped++;
      continue;
    }
    // Already pushed and still waiting for the user. DO NOT re-push — this
    // is the duplicate-notification bug the user flagged.
    if (drafts.some((d) => d.pushed_at)) {
      skipped++;
      continue;
    }
    // Sync with Telegram: if the user already replied to this message outside
    // the bot, mark as sent and move on.
    const autoSynced = await autoSyncIfReplied(t.chat_id, t.message_id, drafts);
    if (autoSynced) {
      autoResolved++;
      continue;
    }
    const best = [...drafts].sort((a, b) => b.confidence - a.confidence)[0];
    if (!best) {
      skipped++;
      continue;
    }
    const tgMessageId = await pushDraftCard(bot, best, drafts);
    // Mark ALL siblings as pushed so next cycle doesn't pick a different
    // style of the same message.
    const pushedAt = new Date().toISOString();
    for (const d of drafts) {
      await storage.saveDraft({
        ...d,
        pushed_at: pushedAt,
        ...(d.id === best.id ? { pushed_message_id: tgMessageId } : {}),
      });
    }
    pushed++;
  }
  return { pushed, skipped, auto_resolved: autoResolved };
}
