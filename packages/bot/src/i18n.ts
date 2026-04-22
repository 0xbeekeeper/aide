export type Lang = "en" | "zh";

export function currentLang(): Lang {
  const v = (process.env["AIDE_LANG"] ?? "en").toLowerCase();
  return v === "zh" || v === "zh-cn" || v === "zh-hans" ? "zh" : "en";
}

/**
 * Very light heuristic: does the text look like it's primarily in the
 * currently-preferred language? Used to decide whether to auto-translate
 * a snippet before showing.
 */
export function looksLikeLang(text: string, lang: Lang): boolean {
  if (text.length === 0) return true;
  const total = text.length;
  const cjk = (text.match(/[\p{Script=Han}]/gu) ?? []).length;
  const ratio = cjk / total;
  if (lang === "zh") return ratio >= 0.15;
  return ratio < 0.15;
}

interface Strings {
  card_from: string;
  card_triage_label: string;
  card_confidence: string;
  card_position_of: (cur: number, total: number) => string;
  card_why_prefix: string;
  card_pending_badge: string;
  card_original_prefix: string;
  btn_send: string;
  btn_cycle: string;
  btn_edit: string;
  btn_context: string;
  btn_skip: string;
  context_header: (n: number) => string;
  context_fetching: string;
  context_failed: (err: string) => string;
  edit_prompt: string;
  edit_cancelled: string;
  skipped_label: string;
  sent_label: string;
  sent_via_edit_label: string;
  failed_prefix: string;
  start_greeting: string;
  not_owner: string;
  cycle_toast: (style: string) => string;
  draft_not_found: string;
  sending_toast: string;
  sent_to: (chatTitle: string) => string;
  send_failed: (err: string) => string;
  draft_gone: string;
  pending_count: (n: number) => string;
  pending_none: string;
}

const EN: Strings = {
  card_from: "from",
  card_triage_label: "triage",
  card_confidence: "conf",
  card_position_of: (c, t) => `(${c}/${t})`,
  card_why_prefix: "why",
  card_pending_badge: "📌 Pending",
  card_original_prefix: "Original",
  btn_send: "✅ Send",
  btn_cycle: "🔄 Next style",
  btn_edit: "📝 Edit",
  btn_context: "🔍 Context",
  btn_skip: "⏭️ Skip",
  context_header: (n: number) => `📚 Last ${n} message(s) in this chat:`,
  context_fetching: "fetching context…",
  context_failed: (err: string) => `❌ couldn't fetch context: ${err}`,
  edit_prompt:
    "📝 Reply to this chat with the text you want sent. I'll send exactly what you type. Type /cancel to abort.",
  edit_cancelled: "edit cancelled.",
  skipped_label: "Skipped",
  sent_label: "Sent",
  sent_via_edit_label: "Sent (edited)",
  failed_prefix: "Failed",
  start_greeting:
    "✓ aide bot is online.\n\nI'll push reply-draft cards here. On each card:\n  ✅ Send       — I send your selected draft as you\n  🔄 Next style — show the next candidate draft\n  📝 Edit       — you type a replacement; I send that\n  ⏭️ Skip       — drop the card without sending\n\n/pending — how many cards are still waiting for you",
  not_owner:
    "This bot is privately configured for its owner. You are not its owner — aborting.",
  cycle_toast: (style) => `→ ${style}`,
  draft_not_found: "draft not found",
  sending_toast: "sending…",
  sent_to: (t) => `✅ sent to ${t}`,
  send_failed: (err) => `❌ send failed: ${err}`,
  draft_gone: "draft no longer exists — aborted.",
  pending_count: (n) => `📌 ${n} pending card(s).`,
  pending_none: "✅ Nothing pending.",
};

const ZH: Strings = {
  card_from: "来自",
  card_triage_label: "triage",
  card_confidence: "置信度",
  card_position_of: (c, t) => `(第 ${c}/${t} 条)`,
  card_why_prefix: "思路",
  card_pending_badge: "📌 待处理",
  card_original_prefix: "原文",
  btn_send: "✅ 发送",
  btn_cycle: "🔄 换风格",
  btn_edit: "📝 编辑",
  btn_context: "🔍 上下文",
  btn_skip: "⏭️ 跳过",
  context_header: (n: number) => `📚 最近 ${n} 条消息：`,
  context_fetching: "拉取上下文中…",
  context_failed: (err: string) => `❌ 拉上下文失败：${err}`,
  edit_prompt:
    "📝 请直接在这里回复你想发送的文字，我会原文发给对方。输入 /cancel 取消。",
  edit_cancelled: "已取消编辑。",
  skipped_label: "已跳过",
  sent_label: "已发送",
  sent_via_edit_label: "已发送（编辑版）",
  failed_prefix: "发送失败",
  start_greeting:
    "✓ aide bot 已上线。\n\n我会把回复草稿以卡片形式推给你。每张卡片上：\n  ✅ 发送     — 用你的身份把草稿发给对方\n  🔄 换风格   — 切换到下一条候选草稿\n  📝 编辑     — 你打字替换草稿，由我发送\n  ⏭️ 跳过     — 不发，关掉卡片\n\n/pending — 查看还剩几张待处理卡片",
  not_owner:
    "此 bot 仅对其 owner 开放。你不是 owner，已终止。",
  cycle_toast: (style) => `→ ${style}`,
  draft_not_found: "找不到对应草稿",
  sending_toast: "发送中…",
  sent_to: (t) => `✅ 已发送给 ${t}`,
  send_failed: (err) => `❌ 发送失败：${err}`,
  draft_gone: "草稿已不存在，已取消。",
  pending_count: (n) => `📌 还有 ${n} 张待处理卡片。`,
  pending_none: "✅ 没有待处理的卡片。",
};

export function t(): Strings {
  return currentLang() === "zh" ? ZH : EN;
}
