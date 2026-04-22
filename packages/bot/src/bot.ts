import { Bot } from "grammy";
import { FilesystemAdapter } from "@aide-os/storage";
import type { ReplyDraft } from "@aide-os/types";
import { cardKeyboard, decodeCallback, renderCard } from "./card.js";
import { readConfig } from "./config.js";
import { getClient } from "@aide-os/mcp-telegram";
import { t } from "./i18n.js";

interface CreateBotOptions {
  token: string;
  ownerId: number;
}

/**
 * In-memory map of draftId → pending-edit awaiting user's typed reply.
 * Keyed by (ownerChatId) since only one owner is supported.
 */
const awaitingEdit = new Map<number, { draftId: string; msgId: number }>();

export function createBot(opts: CreateBotOptions): Bot {
  const bot = new Bot(opts.token);
  const storage = new FilesystemAdapter();

  // Hard guard: ignore every update not from the owner.
  bot.use(async (ctx, next) => {
    const from = ctx.from?.id;
    if (from !== opts.ownerId) {
      if (ctx.chat?.type === "private") {
        await ctx.reply(t().not_owner);
      }
      return;
    }
    await next();
  });

  bot.command("start", async (ctx) => {
    await ctx.reply(t().start_greeting);
  });

  bot.command("ping", (ctx) => ctx.reply("pong"));

  bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;
    const decoded = decodeCallback(data);
    if (!decoded) {
      await ctx.answerCallbackQuery({ text: "unrecognized action" });
      return;
    }
    const { action, draftId } = decoded;
    const drafts = await findDraftsById(storage, draftId);
    if (!drafts) {
      await ctx.answerCallbackQuery({ text: t().draft_not_found });
      return;
    }
    const { selected, siblings } = drafts;
    const s = t();

    if (action === "skip") {
      await storage.markDraftSent(draftId, `skipped:${new Date().toISOString()}`);
      await ctx.editMessageText(
        `⏭️ <b>${esc(s.skipped_label)}</b>  <i>msg ${selected.message_id}</i>\n<blockquote>${esc(selected.source_excerpt ?? "")}</blockquote>`,
        { parse_mode: "HTML", link_preview_options: { is_disabled: true } },
      );
      await ctx.answerCallbackQuery({ text: s.skipped_label });
      return;
    }

    if (action === "cycle") {
      const sorted = [...siblings].sort((a, b) => b.confidence - a.confidence);
      const idx = sorted.findIndex((d) => d.id === draftId);
      const next = sorted[(idx + 1) % sorted.length];
      if (!next) {
        await ctx.answerCallbackQuery({ text: s.draft_not_found });
        return;
      }
      const triage = await storage.getTriage(next.message_id);
      await ctx.editMessageText(renderCard(next, triage ?? undefined, siblings), {
        parse_mode: "HTML",
        reply_markup: cardKeyboard(next),
        link_preview_options: { is_disabled: true },
      });
      await ctx.answerCallbackQuery({ text: s.cycle_toast(next.style) });
      return;
    }

    if (action === "edit") {
      const msgId = ctx.callbackQuery.message?.message_id;
      if (!msgId) {
        await ctx.answerCallbackQuery({ text: s.draft_not_found });
        return;
      }
      awaitingEdit.set(opts.ownerId, { draftId, msgId });
      await ctx.reply(s.edit_prompt);
      await ctx.answerCallbackQuery();
      return;
    }

    if (action === "send") {
      await ctx.answerCallbackQuery({ text: s.sending_toast });
      const result = await sendAsUser(selected.chat_id, selected.text);
      if (result.ok) {
        await storage.markDraftSent(draftId, new Date().toISOString());
        await ctx.editMessageText(
          `✅ <b>${esc(s.sent_label)}</b> — ${esc(selected.style)}  <i>msg ${selected.message_id}</i>\n<blockquote>${esc(selected.text)}</blockquote>`,
          { parse_mode: "HTML", link_preview_options: { is_disabled: true } },
        );
      } else {
        await ctx.editMessageText(
          `❌ <b>${esc(s.failed_prefix)}</b>: ${esc(result.error)}\n<blockquote>${esc(selected.text)}</blockquote>`,
          { parse_mode: "HTML", link_preview_options: { is_disabled: true } },
        );
      }
      return;
    }
  });

  bot.command("cancel", async (ctx) => {
    awaitingEdit.delete(opts.ownerId);
    await ctx.reply(t().edit_cancelled);
  });

  bot.on("message:text", async (ctx) => {
    const pending = awaitingEdit.get(opts.ownerId);
    if (!pending) return;
    const text = ctx.message.text.trim();
    if (text.startsWith("/")) return; // commands go to their handlers
    awaitingEdit.delete(opts.ownerId);

    const drafts = await findDraftsById(storage, pending.draftId);
    if (!drafts) {
      await ctx.reply(t().draft_gone);
      return;
    }
    const { selected } = drafts;

    const result = await sendAsUser(selected.chat_id, text);
    if (result.ok) {
      await storage.markDraftSent(pending.draftId, new Date().toISOString());
      await ctx.reply(
        `${t().sent_to(selected.chat_title ?? selected.chat_id)}:\n\n${text}`,
      );
    } else {
      await ctx.reply(t().send_failed(result.error));
    }
  });

  return bot;
}

async function findDraftsById(
  storage: FilesystemAdapter,
  draftId: string,
): Promise<{ selected: ReplyDraft; siblings: ReplyDraft[] } | null> {
  // draft_id contains message_id as prefix in our convention, but we don't rely
  // on that — do a generic lookup.
  const triages = await storage.listTriage({});
  for (const t of triages) {
    const drafts = await storage.listDrafts(t.message_id);
    const hit = drafts.find((d) => d.id === draftId);
    if (hit) return { selected: hit, siblings: drafts };
  }
  return null;
}

async function sendAsUser(
  chatId: string,
  text: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const client = await getClient();
    const entity = await client.getEntity(chatId);
    await client.sendMessage(entity, { message: text });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
