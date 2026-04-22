import kleur from "kleur";
import { FilesystemAdapter } from "@aide-os/storage";
import type { ChatFilter, ChatFilterMode, ChatFlag } from "@aide-os/types";
import { getClient, toChat } from "@aide-os/mcp-telegram";
import { loadEnv, applyEnvToProcess } from "../env.js";

/**
 * Resolve a mix of numeric chat IDs and @usernames into { id, title } pairs.
 * Inputs like `@izzet`, `izzet`, or `123456789` all work. Usernames that
 * fail to resolve are logged and skipped.
 */
async function resolveIds(
  raw: string[],
): Promise<Array<{ id: string; title: string }>> {
  const out: Array<{ id: string; title: string }> = [];
  let client: Awaited<ReturnType<typeof getClient>> | null = null;
  for (const r of raw) {
    const s = r.trim();
    if (s.length === 0) continue;
    if (/^-?\d+$/.test(s)) {
      out.push({ id: s, title: "" });
      continue;
    }
    const handle = s.replace(/^@/, "");
    try {
      if (!client) client = await getClient();
      const ent = await client.getEntity(handle);
      const chat = toChat(ent);
      if (!chat.id) throw new Error("empty id from getEntity");
      out.push({ id: chat.id, title: chat.title });
    } catch (e) {
      console.error(
        kleur.red(
          `✗ could not resolve @${handle}: ${e instanceof Error ? e.message : e}`,
        ),
      );
    }
  }
  return out;
}

interface ChatRow {
  id: string;
  title: string;
  kind: string;
  unread: number;
  flag: ChatFlag | "unset";
}

async function fetchChats(limit = 300): Promise<ChatRow[]> {
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
  rawIds: string[],
  flag: ChatFlag | null,
): Promise<number> {
  const env = await loadEnv();
  applyEnvToProcess(env);
  const storage = new FilesystemAdapter();
  const filter = await storage.loadChatFilter();

  const resolved = await resolveIds(rawIds);
  if (resolved.length === 0) {
    console.error(kleur.red("Nothing to update (no valid IDs / usernames)."));
    return 1;
  }

  // Best-effort: fill in titles for numeric IDs by looking at recent dialogs.
  // Usernames already have titles from getEntity.
  const needsTitle = resolved.filter((r) => !r.title).map((r) => r.id);
  if (needsTitle.length > 0) {
    const rows = await fetchChats(300);
    const titles = new Map(rows.map((r) => [r.id, r.title]));
    for (const r of resolved) {
      if (!r.title) r.title = titles.get(r.id) ?? "(unknown)";
    }
  }

  for (const { id, title } of resolved) {
    const idx = filter.chats.findIndex((c) => c.id === id);
    if (flag === null) {
      if (idx !== -1) filter.chats.splice(idx, 1);
      continue;
    }
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
