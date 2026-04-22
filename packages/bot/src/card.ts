import type { ReplyDraft, Triage } from "@aide-os/types";
import { t } from "./i18n.js";

export type CardAction = "send" | "cycle" | "edit" | "context" | "skip";

/**
 * Callback data format:  aide:<action>:<draftId>
 * Telegram caps callback_data at 64 bytes.
 */
export function encodeCallback(action: CardAction, draftId: string): string {
  return `aide:${action}:${draftId}`;
}

export interface DecodedCallback {
  action: CardAction;
  draftId: string;
}

export function decodeCallback(data: string): DecodedCallback | null {
  const parts = data.split(":");
  if (parts.length < 3 || parts[0] !== "aide") return null;
  const action = parts[1] as CardAction;
  if (!["send", "cycle", "edit", "context", "skip"].includes(action)) return null;
  const draftId = parts.slice(2).join(":");
  if (!draftId) return null;
  return { action, draftId };
}

export interface CardPayload {
  /** markdown / HTML text for the card body */
  text: string;
  /** which draft is currently selected (the "front" one) */
  selected: ReplyDraft;
  /** full set of drafts for this message (for cycling through styles) */
  allDrafts: ReplyDraft[];
  /** optional triage context */
  triage?: Triage;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Heuristic: is this chat a private DM (not a group/channel)?
 * We don't always have triage handy at render time, so fall back to a
 * title keyword check — Chinese group chats almost always include 群 or 组
 * or English team words; private chats read like personal names.
 */
function isPrivateChat(chatTitle: string): boolean {
  if (!chatTitle) return false;
  const lower = chatTitle.toLowerCase();
  if (/群|组|team|group|channel|小分队|project|chat/.test(lower)) return false;
  if (/《|》|\(|\)/.test(chatTitle)) return false;
  return true;
}

/**
 * Minimal 3-section card: WHO said WHAT + suggested reply.
 * No priority, no confidence numbers, no position counter, no reasoning.
 * Chinese when AIDE_LANG=zh, via source_excerpt_display.
 */
export function renderCard(
  selected: ReplyDraft,
  _triage: Triage | undefined,
  _allDrafts: ReplyDraft[],
): string {
  const s = t();
  const lines: string[] = [];

  // Header: sender + where
  const title = selected.chat_title ?? "";
  const sender = selected.sender_name ?? "?";
  if (isPrivateChat(title)) {
    lines.push(s.card_header_private(esc(sender)));
  } else {
    lines.push(s.card_header_group(esc(sender), esc(title)));
  }

  // What they said — prefer the localized display, else verbatim source
  const quote = selected.source_excerpt_display ?? selected.source_excerpt;
  if (quote) {
    lines.push("");
    lines.push(`<b>${esc(s.card_said_label)}</b>`);
    lines.push(`<blockquote>${esc(quote)}</blockquote>`);
  }

  // Background — summary of ±5 messages around the triaged one
  if (selected.context_summary) {
    lines.push("");
    lines.push(`<b>${esc(s.card_context_label)}</b>`);
    lines.push(`<blockquote>${esc(selected.context_summary)}</blockquote>`);
  }

  // Suggested reply
  lines.push("");
  lines.push(`<b>${esc(s.suggested_reply_label(selected.style))}</b>`);
  lines.push(`<pre>${esc(selected.text)}</pre>`);

  return lines.join("\n");
}

export function cardKeyboard(selected: ReplyDraft) {
  const s = t();
  return {
    inline_keyboard: [
      [
        {
          text: s.btn_send,
          callback_data: encodeCallback("send", selected.id),
        },
        {
          text: s.btn_cycle,
          callback_data: encodeCallback("cycle", selected.id),
        },
      ],
      [
        {
          text: s.btn_context,
          callback_data: encodeCallback("context", selected.id),
        },
        {
          text: s.btn_edit,
          callback_data: encodeCallback("edit", selected.id),
        },
      ],
      [
        {
          text: s.btn_skip,
          callback_data: encodeCallback("skip", selected.id),
        },
      ],
    ],
  };
}
