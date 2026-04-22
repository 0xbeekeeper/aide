import { Bot } from "grammy";
import { FilesystemAdapter } from "@aide-os/storage";
import type { ReplyDraft } from "@aide-os/types";
import { cardKeyboard, decodeCallback, renderCard } from "./card.js";
import { readConfig } from "./config.js";
import { getClient, resolveEntity } from "@aide-os/mcp-telegram";
import { t } from "./i18n.js";
import { buildAskPrompt, runClaudeAndCapture } from "./ask.js";

interface CreateBotOptions {
  token: string;
  ownerId: number;
}

/**
 * In-memory map of draftId → pending-edit awaiting user's typed reply.
 * Keyed by (ownerChatId) since only one owner is supported.
 */
const awaitingEdit = new Map<number, { draftId: string; msgId: number }>();

/**
 * Follow-up ("追问") conversation state per owner. Unlike edit, this
 * persists across turns until the user sends /done. The referenced
 * draft_id anchors us to a specific card so the prompt can include its
 * context every turn.
 */
const askingAbout = new Map<number, { draftId: string; cardMsgId: number }>();

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

  bot.command("pending", async (ctx) => {
    const triages = await storage.listTriage({ needs_reply: true });
    let n = 0;
    for (const tt of triages) {
      const drafts = await storage.listDrafts(tt.message_id);
      if (drafts.length > 0 && !drafts.some((d) => d.sent_at)) n++;
    }
    await ctx.reply(n === 0 ? t().pending_none : t().pending_count(n));
  });

  bot.command("tasks", async (ctx) => {
    const tasks = await storage.listTasks({ status: "open" });
    const now = Date.now();
    const active = tasks.filter((tk) => {
      if (!tk.snoozed_until) return true;
      return new Date(tk.snoozed_until).getTime() <= now;
    });
    if (active.length === 0) {
      await ctx.reply(t().tasks_none);
      return;
    }
    const s = t();
    await ctx.reply(`<b>${esc(s.tasks_header(active.length))}</b>`, {
      parse_mode: "HTML",
    });
    for (const tk of active.slice(0, 20)) {
      const line = s.task_line(
        tk.action,
        tk.owner ?? "?",
        tk.deadline ?? null,
      );
      await ctx.reply(line, {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: s.btn_task_done,
                callback_data: `aide-t:done:${tk.id}`,
              },
              {
                text: s.btn_task_snooze,
                callback_data: `aide-t:snooze:${tk.id}`,
              },
              {
                text: s.btn_task_drop,
                callback_data: `aide-t:drop:${tk.id}`,
              },
            ],
          ],
        },
      });
    }
  });

  bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;

    // Task action callbacks (prefix aide-t:)
    if (data.startsWith("aide-t:")) {
      const parts = data.split(":");
      const action = parts[1];
      const taskId = parts.slice(2).join(":");
      const s = t();
      if (!taskId) {
        await ctx.answerCallbackQuery({ text: s.task_not_found });
        return;
      }
      const allTasks = await storage.listTasks({});
      const task = allTasks.find((x) => x.id === taskId);
      if (!task) {
        await ctx.answerCallbackQuery({ text: s.task_not_found });
        return;
      }
      if (action === "done") {
        await storage.updateTaskStatus(taskId, "done");
        await ctx.editMessageText(
          `✅ <s>${esc(task.action)}</s>`,
          { parse_mode: "HTML" },
        );
        await ctx.answerCallbackQuery({ text: s.task_done_toast });
        return;
      }
      if (action === "drop") {
        await storage.updateTaskStatus(taskId, "dropped");
        await ctx.editMessageText(
          `🗑 <s>${esc(task.action)}</s>`,
          { parse_mode: "HTML" },
        );
        await ctx.answerCallbackQuery({ text: s.task_drop_toast });
        return;
      }
      if (action === "snooze") {
        const until = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        await storage.saveTask({ ...task, snoozed_until: until });
        await ctx.editMessageText(
          `⏰ ${esc(task.action)}  <i>(snoozed → ${esc(until.slice(0, 16))})</i>`,
          { parse_mode: "HTML" },
        );
        await ctx.answerCallbackQuery({ text: s.task_snooze_toast });
        return;
      }
      await ctx.answerCallbackQuery({ text: "unknown task action" });
      return;
    }

    // Draft card callbacks (prefix aide:)
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

    if (action === "ask") {
      const cardMsgId = ctx.callbackQuery.message?.message_id;
      if (!cardMsgId) {
        await ctx.answerCallbackQuery({ text: s.draft_not_found });
        return;
      }
      askingAbout.set(opts.ownerId, { draftId, cardMsgId });
      // Clear any pending edit — can't be in both modes at once.
      awaitingEdit.delete(opts.ownerId);
      const who = selected.sender_name ?? "?";
      await ctx.reply(s.ask_prompt(who), {
        reply_parameters: { message_id: cardMsgId },
      });
      await ctx.answerCallbackQuery();
      return;
    }

    if (action === "context") {
      const cardMsgId = ctx.callbackQuery.message?.message_id;
      await ctx.answerCallbackQuery({ text: s.context_fetching });
      try {
        const client = await getClient();
        const entity = await resolveEntity(client, selected.chat_id);
        const me = await client.getMe();
        const selfId = String((me as { id: unknown }).id ?? "");

        // Anchor around the triaged message so context is topical to the
        // card, not the current tail of the chat.
        const anchor = Number(selected.message_id);
        const beforeMsgs = Number.isFinite(anchor)
          ? await client.getMessages(entity, { limit: 8, offsetId: anchor })
          : [];
        const afterMsgs = Number.isFinite(anchor)
          ? await client.getMessages(entity, { limit: 2, minId: anchor })
          : [];
        const anchorMsgs = Number.isFinite(anchor)
          ? await client.getMessages(entity, { ids: [anchor] })
          : [];
        const msgs = Number.isFinite(anchor)
          ? [
              ...[...beforeMsgs],
              ...anchorMsgs,
              ...[...afterMsgs].reverse(),
            ].reverse()
          : await client.getMessages(entity, { limit: 10 });

        const lines: string[] = [`<b>${esc(s.context_header(msgs.length))}</b>`];
        // msgs are newest first; show oldest→newest for reading flow
        for (const m of [...msgs].reverse()) {
          if (!m || typeof m.message !== "string" || m.message.length === 0) continue;
          const ts = new Date((m.date ?? 0) * 1000).toLocaleString("zh-CN", {
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          });
          let who = "?";
          if (m.senderId) {
            const sid = String(m.senderId);
            if (sid === selfId) {
              who = "👤 你";
            } else {
              try {
                const ent = await client.getEntity(m.senderId);
                const name =
                  [
                    (ent as { firstName?: string }).firstName ?? "",
                    (ent as { lastName?: string }).lastName ?? "",
                  ]
                    .join(" ")
                    .trim() ||
                  (ent as { username?: string }).username ||
                  "?";
                who = esc(name);
              } catch {
                who = esc(sid);
              }
            }
          }
          lines.push(
            `<i>${esc(ts)}</i> · <b>${who}</b>\n${esc(m.message)}`,
          );
        }
        const body = lines.join("\n\n");
        await ctx.reply(body, {
          parse_mode: "HTML",
          link_preview_options: { is_disabled: true },
          ...(cardMsgId ? { reply_parameters: { message_id: cardMsgId } } : {}),
        });
      } catch (e) {
        await ctx.reply(
          s.context_failed(e instanceof Error ? e.message : String(e)),
          cardMsgId ? { reply_parameters: { message_id: cardMsgId } } : {},
        );
      }
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

  bot.command("done", async (ctx) => {
    const had = askingAbout.delete(opts.ownerId);
    await ctx.reply(had ? t().ask_done : t().ask_no_active);
  });

  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text.trim();
    if (text.startsWith("/")) return; // commands go to their own handlers

    // Priority 1: edit mode (single turn, consume and send)
    const pendingEdit = awaitingEdit.get(opts.ownerId);
    if (pendingEdit) {
      awaitingEdit.delete(opts.ownerId);
      const drafts = await findDraftsById(storage, pendingEdit.draftId);
      if (!drafts) {
        await ctx.reply(t().draft_gone);
        return;
      }
      const { selected } = drafts;
      const result = await sendAsUser(selected.chat_id, text);
      const s2 = t();
      if (result.ok) {
        await storage.markDraftSent(
          pendingEdit.draftId,
          new Date().toISOString(),
        );
        await ctx.reply(
          `${s2.sent_to(selected.chat_title ?? selected.chat_id)}:\n\n${text}`,
        );
        try {
          await ctx.api.editMessageText(
            ctx.chat.id,
            pendingEdit.msgId,
            `✅ <b>${esc(s2.sent_via_edit_label)}</b>  <i>msg ${selected.message_id}</i>\n<blockquote>${esc(text)}</blockquote>`,
            {
              parse_mode: "HTML",
              link_preview_options: { is_disabled: true },
            },
          );
        } catch {
          // card may be older than TG's 48h edit window — safe to swallow
        }
      } else {
        await ctx.reply(s2.send_failed(result.error));
      }
      return;
    }

    // Priority 2: ask mode (multi-turn, stays open until /done)
    const asking = askingAbout.get(opts.ownerId);
    if (asking) {
      const drafts = await findDraftsById(storage, asking.draftId);
      if (!drafts) {
        askingAbout.delete(opts.ownerId);
        await ctx.reply(t().draft_gone);
        return;
      }
      const { selected, siblings } = drafts;
      const triage = await storage.getTriage(selected.message_id);

      // Persist the user's question BEFORE running claude so if it crashes
      // the audit log still shows what was asked.
      const nowUser = new Date().toISOString();
      await storage.appendConversationTurn(
        selected.message_id,
        { role: "user", text, ts: nowUser },
        {
          chat_id: selected.chat_id,
          ...(selected.chat_title !== undefined
            ? { chat_title: selected.chat_title }
            : {}),
          ...(selected.sender_name !== undefined
            ? { sender_name: selected.sender_name }
            : {}),
        },
      );

      // Ack immediately, then compute (claude -p takes a few seconds).
      const thinkingMsg = await ctx.reply(t().ask_thinking, {
        reply_parameters: { message_id: asking.cardMsgId },
      });

      try {
        const prompt = await buildAskPrompt(
          { draft: selected, siblings, triage },
          text,
        );
        const answer = await runClaudeAndCapture(prompt);
        const nowAssistant = new Date().toISOString();
        await storage.appendConversationTurn(selected.message_id, {
          role: "assistant",
          text: answer,
          ts: nowAssistant,
        });
        // Replace the "thinking…" placeholder with the actual answer.
        try {
          await ctx.api.editMessageText(
            ctx.chat.id,
            thinkingMsg.message_id,
            answer.length > 0 ? answer : "(empty answer)",
            { link_preview_options: { is_disabled: true } },
          );
        } catch {
          // If the answer has markdown-like chars editMessageText rejects,
          // fall back to a fresh reply.
          await ctx.reply(answer, {
            reply_parameters: { message_id: asking.cardMsgId },
            link_preview_options: { is_disabled: true },
          });
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        try {
          await ctx.api.editMessageText(
            ctx.chat.id,
            thinkingMsg.message_id,
            t().ask_failed(msg),
          );
        } catch {
          await ctx.reply(t().ask_failed(msg));
        }
      }
      return;
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
    const entity = await resolveEntity(client, chatId);
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
