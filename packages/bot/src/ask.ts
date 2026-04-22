import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { FilesystemAdapter } from "@aide-os/storage";
import type { ReplyDraft, Triage } from "@aide-os/types";

/** Load ~/.config/aide/profile.md, if present, to inject into the ask prompt. */
async function loadProfile(): Promise<string | null> {
  const p = join(homedir(), ".config", "aide", "profile.md");
  if (!existsSync(p)) return null;
  return (await readFile(p, "utf8")).trim();
}

/**
 * Spawn claude -p (headless) with the given prompt and return its stdout.
 * Honors AIDE_LANG via inherited env. 2-minute hard timeout.
 */
export function runClaudeAndCapture(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "claude",
      ["-p", "--permission-mode", "bypassPermissions", prompt],
      { env: process.env, stdio: ["ignore", "pipe", "pipe"] },
    );
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("claude timed out after 120s"));
    }, 120_000);
    child.stdout?.on("data", (d) => (out += d.toString()));
    child.stderr?.on("data", (d) => (err += d.toString()));
    child.on("exit", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out.trim());
      else reject(new Error(err.trim() || `claude exited ${code}`));
    });
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
  });
}

export interface AskContext {
  triage: Triage | null;
  draft: ReplyDraft;
  siblings: ReplyDraft[];
}

/**
 * Build the prompt passed to aide-ask for a single question turn. Includes
 * the user profile, the card's full context (triage summary / 对方说 /
 * 背景 / three draft options), any prior turns, and the new question.
 */
export async function buildAskPrompt(
  ctx: AskContext,
  question: string,
): Promise<string> {
  const storage = new FilesystemAdapter();
  const profile = await loadProfile();
  const conv = await storage.getConversation(ctx.draft.message_id);

  const parts: string[] = [];
  if (profile) {
    parts.push("<user_profile>");
    parts.push(profile);
    parts.push("</user_profile>");
    parts.push("");
  }

  parts.push(
    "Use the aide-ask skill. Answer the user's question about the card context below. Respond in AIDE_LANG (Chinese if zh). Stay focused and concise. Do NOT send any Telegram message.",
  );
  parts.push("");

  parts.push("<card_context>");
  parts.push(`message_id: ${ctx.draft.message_id}`);
  parts.push(`chat: ${ctx.draft.chat_title ?? ctx.draft.chat_id}`);
  parts.push(`sender: ${ctx.draft.sender_name ?? "?"}`);
  if (ctx.draft.source_excerpt) {
    parts.push(`original: ${ctx.draft.source_excerpt}`);
  }
  if (ctx.draft.source_excerpt_display) {
    parts.push(`translated/cleaned: ${ctx.draft.source_excerpt_display}`);
  }
  if (ctx.triage) {
    parts.push(
      `triage: priority=${ctx.triage.priority} intent=${ctx.triage.intent} summary="${ctx.triage.summary}"`,
    );
  }
  if (ctx.draft.context_summary) {
    parts.push(`background: ${ctx.draft.context_summary}`);
  }
  parts.push("");
  parts.push("current draft options:");
  const byStyle = new Map<string, ReplyDraft>();
  for (const d of ctx.siblings) {
    const prev = byStyle.get(d.style);
    if (!prev || d.created_at > prev.created_at) byStyle.set(d.style, d);
  }
  for (const style of ["professional", "push", "casual"]) {
    const d = byStyle.get(style);
    if (d) parts.push(`  ${style}: ${d.text}`);
  }
  parts.push("</card_context>");
  parts.push("");

  if (conv && conv.turns.length > 0) {
    parts.push("<prior_turns>");
    for (const turn of conv.turns) {
      parts.push(
        `${turn.role === "user" ? "User" : "Assistant"}: ${turn.text}`,
      );
    }
    parts.push("</prior_turns>");
    parts.push("");
  }

  parts.push(`User's new question: ${question}`);
  parts.push("");
  parts.push(
    "Respond now with your answer only. Do not restate the question.",
  );

  return parts.join("\n");
}
