import { Bot } from "grammy";
import { FilesystemAdapter } from "@aide-os/storage";
import type { DailyBrief } from "@aide-os/types";
import { readConfig } from "./config.js";

/**
 * Push the most recently saved brief to the bot owner as a Telegram message.
 * Splits long content into chunks so it doesn't exceed Telegram's 4096-char limit.
 * Returns true if something was sent, false if no brief or config is missing.
 */
export async function pushLatestBrief(): Promise<boolean> {
  const cfg = await readConfig();
  if (!cfg) return false;
  const storage = new FilesystemAdapter();
  const brief: DailyBrief | null = await storage.getLatestBrief();
  if (!brief) return false;

  const bot = new Bot(cfg.bot_token);
  const body = brief.markdown.trim();
  const chunks = chunk(body, 3800);
  for (const c of chunks) {
    await bot.api.sendMessage(cfg.owner_chat_id, c, {
      // Markdown in Telegram is touchy; ship plain text + blockquotes via HTML.
      // Since aide-brief already writes human-readable markdown, send as plain.
      link_preview_options: { is_disabled: true },
    });
  }
  return true;
}

function chunk(s: string, size: number): string[] {
  if (s.length <= size) return [s];
  const out: string[] = [];
  let i = 0;
  while (i < s.length) {
    // Try to break on a newline near the limit to avoid splitting mid-sentence.
    let end = Math.min(i + size, s.length);
    if (end < s.length) {
      const nl = s.lastIndexOf("\n", end);
      if (nl > i + size / 2) end = nl;
    }
    out.push(s.slice(i, end));
    i = end;
    if (s[i] === "\n") i += 1;
  }
  return out;
}
