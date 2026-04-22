export type Lang = "en" | "zh";

export function currentLang(): Lang {
  const v = (process.env["AIDE_LANG"] ?? "en").toLowerCase();
  return v === "zh" || v === "zh-cn" || v === "zh-hans" ? "zh" : "en";
}

interface Strings {
  card_from: string;
  card_triage_label: string;
  card_confidence: string;
  card_position_of: (cur: number, total: number) => string;
  card_why_prefix: string;
  btn_send: string;
  btn_cycle: string;
  btn_edit: string;
  btn_skip: string;
  edit_prompt: string;
  edit_cancelled: string;
  skipped_label: string;
  sent_label: string;
  failed_prefix: string;
  start_greeting: string;
  not_owner: string;
  cycle_toast: (style: string) => string;
  draft_not_found: string;
  sending_toast: string;
  sent_to: (chatTitle: string) => string;
  send_failed: (err: string) => string;
  draft_gone: string;
}

const EN: Strings = {
  card_from: "from",
  card_triage_label: "triage",
  card_confidence: "conf",
  card_position_of: (c, t) => `(${c}/${t})`,
  card_why_prefix: "why",
  btn_send: "✅ Send",
  btn_cycle: "🔄 Next style",
  btn_edit: "📝 Edit",
  btn_skip: "⏭️ Skip",
  edit_prompt:
    "📝 Reply to this chat with the text you want sent. I'll send exactly what you type. Type /cancel to abort.",
  edit_cancelled: "edit cancelled.",
  skipped_label: "Skipped",
  sent_label: "Sent",
  failed_prefix: "Failed",
  start_greeting:
    "✓ aide bot is online.\n\nI'll push reply-draft cards here. On each card:\n  ✅ Send       — I send your selected draft as you\n  🔄 Next style — show the next candidate draft\n  📝 Edit       — you type a replacement; I send that\n  ⏭️ Skip       — drop the card without sending",
  not_owner:
    "This bot is privately configured for its owner. You are not its owner — aborting.",
  cycle_toast: (style) => `→ ${style}`,
  draft_not_found: "draft not found",
  sending_toast: "sending…",
  sent_to: (t) => `✅ sent to ${t}`,
  send_failed: (err) => `❌ send failed: ${err}`,
  draft_gone: "draft no longer exists — aborted.",
};

const ZH: Strings = {
  card_from: "来自",
  card_triage_label: "triage",
  card_confidence: "置信度",
  card_position_of: (c, t) => `(第 ${c}/${t} 条)`,
  card_why_prefix: "思路",
  btn_send: "✅ 发送",
  btn_cycle: "🔄 换风格",
  btn_edit: "📝 编辑",
  btn_skip: "⏭️ 跳过",
  edit_prompt:
    "📝 请直接在这里回复你想发送的文字，我会原文发给对方。输入 /cancel 取消。",
  edit_cancelled: "已取消编辑。",
  skipped_label: "已跳过",
  sent_label: "已发送",
  failed_prefix: "发送失败",
  start_greeting:
    "✓ aide bot 已上线。\n\n我会把回复草稿以卡片形式推给你。每张卡片上：\n  ✅ 发送     — 用你的身份把草稿发给对方\n  🔄 换风格   — 切换到下一条候选草稿\n  📝 编辑     — 你打字替换草稿，由我发送\n  ⏭️ 跳过     — 不发，关掉卡片",
  not_owner:
    "此 bot 仅对其 owner 开放。你不是 owner，已终止。",
  cycle_toast: (style) => `→ ${style}`,
  draft_not_found: "找不到对应草稿",
  sending_toast: "发送中…",
  sent_to: (t) => `✅ 已发送给 ${t}`,
  send_failed: (err) => `❌ 发送失败：${err}`,
  draft_gone: "草稿已不存在，已取消。",
};

export function t(): Strings {
  return currentLang() === "zh" ? ZH : EN;
}
