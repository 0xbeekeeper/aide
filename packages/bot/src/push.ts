import type { Bot } from "grammy";
import { FilesystemAdapter } from "@aide-os/storage";
import type { ReplyDraft } from "@aide-os/types";
import { cardKeyboard, renderCard } from "./card.js";
import { readConfig } from "./config.js";

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
 * Push every pending draft (highest-confidence per message) to the owner.
 * Skips drafts whose source message has already been sent or skipped.
 * Returns { pushed, skipped } counts.
 */
export async function pushAllPending(
  bot: Bot,
): Promise<{ pushed: number; skipped: number }> {
  const storage = new FilesystemAdapter();
  const triages = await storage.listTriage({ needs_reply: true });
  let pushed = 0;
  let skipped = 0;
  for (const t of triages) {
    const drafts = await storage.listDrafts(t.message_id);
    if (drafts.length === 0) {
      skipped++;
      continue;
    }
    if (drafts.some((d) => d.sent_at)) {
      skipped++;
      continue;
    }
    const best = [...drafts].sort((a, b) => b.confidence - a.confidence)[0];
    if (!best) {
      skipped++;
      continue;
    }
    await pushDraftCard(bot, best, drafts);
    pushed++;
  }
  return { pushed, skipped };
}
