import type { ReplyDraft, Triage } from "@aide-os/types";
import { t } from "./i18n.js";

export type CardAction = "send" | "cycle" | "edit" | "skip";

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
  if (!["send", "cycle", "edit", "skip"].includes(action)) return null;
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

function styleEmoji(style: ReplyDraft["style"]): string {
  if (style === "professional") return "💼";
  if (style === "push") return "🔥";
  return "💬";
}

function confDot(c: number): string {
  if (c >= 0.85) return "🟢";
  if (c >= 0.6) return "🟡";
  return "🔴";
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Render a card body in HTML (grammY supports parse_mode=HTML). */
export function renderCard(
  selected: ReplyDraft,
  triage: Triage | undefined,
  allDrafts: ReplyDraft[],
): string {
  const s = t();
  const lines: string[] = [];
  const title = selected.chat_title ?? `chat ${selected.chat_id}`;
  const sender = selected.sender_name ?? "?";
  lines.push(
    `📩 <b>${esc(title)}</b> · ${esc(s.card_from)} <i>${esc(sender)}</i>`,
  );
  if (selected.source_excerpt) {
    const quoted = selected.source_excerpt
      .split("\n")
      .map((l) => `<i>${esc(l)}</i>`)
      .join("\n");
    lines.push(`<blockquote>${quoted}</blockquote>`);
  }
  if (triage) {
    lines.push(
      `🧠 ${esc(triage.priority)} / ${esc(triage.intent)}  ${esc(s.card_confidence)} ${triage.confidence.toFixed(2)}`,
    );
  }
  lines.push("");
  const idx = allDrafts.findIndex((d) => d.id === selected.id);
  const pos = idx === -1 ? 1 : idx + 1;
  lines.push(
    `${styleEmoji(selected.style)} <b>${selected.style.toUpperCase()}</b>  ${confDot(selected.confidence)} <code>${selected.confidence.toFixed(2)}</code>  <i>${esc(s.card_position_of(pos, allDrafts.length))}</i>`,
  );
  lines.push(`<pre>${esc(selected.text)}</pre>`);
  if (selected.reasoning) {
    lines.push(`<i>${esc(s.card_why_prefix)}: ${esc(selected.reasoning)}</i>`);
  }
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
          text: s.btn_edit,
          callback_data: encodeCallback("edit", selected.id),
        },
        {
          text: s.btn_skip,
          callback_data: encodeCallback("skip", selected.id),
        },
      ],
    ],
  };
}
