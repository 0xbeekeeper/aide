import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { FilesystemAdapter } from "@aide-os/storage";

export const notionChatConversationId = (ownerId: number): string =>
  `notion-chat__${ownerId}`;

async function loadProfile(): Promise<string | null> {
  const p = join(homedir(), ".config", "aide", "profile.md");
  if (!existsSync(p)) return null;
  return (await readFile(p, "utf8")).trim();
}

/**
 * Build the prompt sent to `claude -p` for a /notion chat turn. Includes the
 * user profile, any prior turns of this Notion-chat conversation (so
 * multi-turn works), env hints for default DBs, and the new instruction.
 */
export async function buildNotionChatPrompt(
  ownerId: number,
  instruction: string,
): Promise<string> {
  const storage = new FilesystemAdapter();
  const profile = await loadProfile();
  const conv = await storage.getConversation(notionChatConversationId(ownerId));

  const parts: string[] = [];
  if (profile) {
    parts.push("<user_profile>");
    parts.push(profile);
    parts.push("</user_profile>");
    parts.push("");
  }

  parts.push(
    "Use the aide-notion-chat skill. The user is chatting directly with aide to operate Notion — there is no reply-card context. Respond in AIDE_LANG. Do NOT send any Telegram message.",
  );
  parts.push("");

  const envHints: string[] = [];
  const tasksDb = process.env["AIDE_NOTION_TASKS_DB"];
  const briefsPage = process.env["AIDE_NOTION_BRIEFS_PAGE"];
  const expectedEmail = process.env["AIDE_NOTION_EXPECTED_EMAIL"];
  if (tasksDb) envHints.push(`AIDE_NOTION_TASKS_DB=${tasksDb}`);
  if (briefsPage) envHints.push(`AIDE_NOTION_BRIEFS_PAGE=${briefsPage}`);
  if (expectedEmail)
    envHints.push(`AIDE_NOTION_EXPECTED_EMAIL=${expectedEmail}`);
  if (envHints.length > 0) {
    parts.push("<env_hints>");
    parts.push(...envHints);
    parts.push("</env_hints>");
    parts.push("");
  }

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

  parts.push(`User's new instruction: ${instruction}`);
  parts.push("");
  parts.push("Respond now with your answer only. Do not restate the request.");

  return parts.join("\n");
}
