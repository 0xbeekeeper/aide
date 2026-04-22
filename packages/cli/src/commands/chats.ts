import kleur from "kleur";
import { FilesystemAdapter } from "@aide-os/storage";
import type { ChatFilter, ChatFilterMode, ChatFlag } from "@aide-os/types";
import { getClient, toChat } from "@aide-os/mcp-telegram";
import { loadEnv, applyEnvToProcess } from "../env.js";

interface ChatRow {
  id: string;
  title: string;
  kind: string;
  unread: number;
  flag: ChatFlag | "unset";
}

async function fetchChats(limit = 100): Promise<ChatRow[]> {
  const storage = new FilesystemAdapter();
  const filter = await storage.loadChatFilter();
  const client = await getClient();
  const dialogs = await client.getDialogs({ limit });
  const rows: ChatRow[] = [];
  for (const d of dialogs) {
    const chat = toChat(d.entity);
    const entry = filter.chats.find((c) => c.id === chat.id);
    rows.push({
      id: chat.id,
      title: chat.title,
      kind: chat.kind,
      unread: d.unreadCount ?? 0,
      flag: entry?.flag ?? "unset",
    });
  }
  try {
    await client.disconnect();
  } catch {
    // ignore
  }
  return rows;
}

function flagLabel(flag: ChatRow["flag"]): string {
  if (flag === "work") return kleur.green("work");
  if (flag === "ignore") return kleur.red("ignore");
  return kleur.dim("—");
}

function printTable(rows: ChatRow[], filter: ChatFilter): void {
  console.log(
    kleur.bold(`\ncos chats  —  mode: ${kleur.cyan(filter.mode)}\n`),
  );
  console.log(
    kleur.dim(
      `  ${"ID".padEnd(14)} ${"FLAG".padEnd(7)} ${"UNREAD".padEnd(7)} ${"KIND".padEnd(8)} TITLE`,
    ),
  );
  for (const r of rows) {
    console.log(
      `  ${r.id.padEnd(14)} ${flagLabel(r.flag).padEnd(16)} ${String(r.unread).padEnd(7)} ${r.kind.padEnd(8)} ${r.title}`,
    );
  }
  console.log();
  console.log(
    kleur.dim(
      "Mark a chat:  aide chats work <id> | aide chats ignore <id> | aide chats reset <id>\n" +
        "Change mode:  aide chats mode <whitelist|blacklist|off>",
    ),
  );
  console.log();
}

export async function chatsListCommand(): Promise<number> {
  const env = await loadEnv();
  applyEnvToProcess(env);
  const storage = new FilesystemAdapter();
  const filter = await storage.loadChatFilter();
  const rows = await fetchChats(100);
  printTable(rows, filter);
  return 0;
}

async function modifyFlags(
  ids: string[],
  flag: ChatFlag | null,
): Promise<number> {
  const env = await loadEnv();
  applyEnvToProcess(env);
  const storage = new FilesystemAdapter();
  const filter = await storage.loadChatFilter();

  const rows = await fetchChats(200);
  const titles = new Map(rows.map((r) => [r.id, r.title]));

  for (const id of ids) {
    const idx = filter.chats.findIndex((c) => c.id === id);
    if (flag === null) {
      if (idx !== -1) filter.chats.splice(idx, 1);
      continue;
    }
    const title = titles.get(id) ?? "(unknown)";
    const entry = {
      id,
      title,
      flag,
      added_at: new Date().toISOString(),
    };
    if (idx === -1) filter.chats.push(entry);
    else filter.chats[idx] = entry;
  }

  if (filter.mode === "off" && flag === "work" && filter.chats.length > 0) {
    filter.mode = "whitelist";
  }

  await storage.saveChatFilter(filter);
  console.log(
    kleur.green(
      `✓ updated filter (mode=${filter.mode}, ${filter.chats.length} chat flags set)`,
    ),
  );
  return 0;
}

export async function chatsWorkCommand(ids: string[]): Promise<number> {
  if (ids.length === 0) {
    console.error(
      kleur.red("Usage: aide chats work <chat_id> [<chat_id> …]"),
    );
    return 1;
  }
  return modifyFlags(ids, "work");
}

export async function chatsIgnoreCommand(ids: string[]): Promise<number> {
  if (ids.length === 0) {
    console.error(
      kleur.red("Usage: aide chats ignore <chat_id> [<chat_id> …]"),
    );
    return 1;
  }
  return modifyFlags(ids, "ignore");
}

export async function chatsResetCommand(ids: string[]): Promise<number> {
  if (ids.length === 0) {
    console.error(
      kleur.red("Usage: aide chats reset <chat_id> [<chat_id> …]"),
    );
    return 1;
  }
  return modifyFlags(ids, null);
}

export async function chatsModeCommand(mode: string): Promise<number> {
  const valid: ChatFilterMode[] = ["whitelist", "blacklist", "off"];
  if (!valid.includes(mode as ChatFilterMode)) {
    console.error(
      kleur.red(`Invalid mode: ${mode}. Use one of: ${valid.join(", ")}`),
    );
    return 1;
  }
  const storage = new FilesystemAdapter();
  const filter = await storage.loadChatFilter();
  filter.mode = mode as ChatFilterMode;
  await storage.saveChatFilter(filter);
  console.log(kleur.green(`✓ filter mode set to ${mode}`));
  return 0;
}
