import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getClient } from "./client.js";
import { toChat, toMessage } from "./map.js";
import type { Chat, Message } from "@aide-os/types";
import { FilesystemAdapter } from "@aide-os/storage";

function json(data: unknown) {
  return {
    content: [
      { type: "text" as const, text: JSON.stringify(data, null, 2) },
    ],
  };
}

function err(e: unknown) {
  return {
    isError: true,
    content: [
      { type: "text" as const, text: e instanceof Error ? e.message : String(e) },
    ],
  };
}

export interface TelegramServerOptions {
  name?: string;
  version?: string;
  /** When true, the server refuses to expose send_message. Default true. */
  readOnly?: boolean;
}

export function createTelegramServer(
  opts: TelegramServerOptions = {},
): McpServer {
  const readOnly = opts.readOnly ?? true;
  const server = new McpServer({
    name: opts.name ?? "aide-telegram",
    version: opts.version ?? "0.0.0",
  });

  server.registerTool(
    "list_unread",
    {
      title: "List Unread (or recent) Messages",
      description:
        "List messages across allowed chats. By default only returns messages Telegram still marks unread. Pass include_read=true to instead scan all messages in the time window regardless of read state. Pass skip_if_replied=true to drop any message the user has already replied to. Pass collapse_threads=true (default true) to merge consecutive messages from the same sender within 10 min into a single 'conversation unit' — dramatically reduces noise when someone sends 10 rapid messages. since = ISO 8601 lower bound.",
      inputSchema: {
        since: z.string().optional(),
        limit: z.number().int().positive().max(500).optional(),
        include_read: z.boolean().optional(),
        skip_if_replied: z.boolean().optional(),
        collapse_threads: z.boolean().optional(),
      },
    },
    async ({
      since,
      limit,
      include_read,
      skip_if_replied,
      collapse_threads,
    }) => {
      try {
        const client = await getClient();
        const me = await client.getMe();
        const selfId = String((me as { id: unknown }).id ?? "");
        const sinceTs = since ? new Date(since).getTime() : 0;
        const cap = limit ?? 50;
        const scanRead = include_read === true;
        const skipReplied = skip_if_replied === true;
        const collapse = collapse_threads !== false;
        const MAX_GAP_MS = 10 * 60 * 1000;

        const filter = await new FilesystemAdapter().loadChatFilter();
        const chatAllowed = (chatId: string): boolean => {
          if (filter.mode === "off") return true;
          const entry = filter.chats.find((c) => c.id === chatId);
          if (filter.mode === "whitelist") {
            return entry?.flag === "work";
          }
          return entry?.flag !== "ignore";
        };

        const dialogs = await client.getDialogs({ limit: 100 });
        const out: Message[] = [];
        let droppedReplied = 0;
        let collapsedGroups = 0;
        let rawMessages = 0;

        for (const dialog of dialogs) {
          const unread = dialog.unreadCount ?? 0;
          const entity = dialog.entity;
          const entityId = String((entity as { id?: unknown } | null)?.id ?? "");
          if (!chatAllowed(entityId)) continue;

          if (!scanRead && unread <= 0) continue;
          const pullLimit = scanRead ? 50 : unread;

          const msgs = await client.getMessages(entity, { limit: pullLimit });

          // Pass 1 — filter candidates (non-self, in window, not replied to).
          const candidates: typeof msgs = [];
          let seenSelfAfter = false;
          for (const m of msgs) {
            if (!m) continue;
            const senderIsSelf =
              m.senderId !== undefined &&
              m.senderId !== null &&
              String(m.senderId) === selfId;
            const ts = (m.date ?? 0) * 1000;
            if (senderIsSelf) {
              seenSelfAfter = true;
              continue;
            }
            if (ts < sinceTs) break;
            if (skipReplied && seenSelfAfter) {
              droppedReplied++;
              continue;
            }
            candidates.push(m);
          }

          if (candidates.length === 0) continue;

          // Flip to chronological order for grouping.
          candidates.reverse();
          rawMessages += candidates.length;

          if (!collapse) {
            for (const m of candidates) {
              const mapped = await toMessage(client, m, entity, selfId);
              mapped.is_unread = scanRead ? false : true;
              out.push(mapped);
              if (out.length >= cap) break;
            }
            if (out.length >= cap) break;
            continue;
          }

          // Pass 2 — group by (sender, 10-min gap).
          type Group = (typeof candidates)[number][];
          const groups: Group[] = [];
          for (const m of candidates) {
            const last = groups[groups.length - 1];
            const lastMsg = last && last.length > 0 ? last[last.length - 1] : undefined;
            const lastSender =
              lastMsg && lastMsg.senderId !== undefined && lastMsg.senderId !== null
                ? String(lastMsg.senderId)
                : null;
            const currSender =
              m.senderId !== undefined && m.senderId !== null
                ? String(m.senderId)
                : null;
            const gap =
              lastMsg !== undefined
                ? ((m.date ?? 0) - (lastMsg.date ?? 0)) * 1000
                : Infinity;
            if (
              last !== undefined &&
              lastSender !== null &&
              currSender !== null &&
              lastSender === currSender &&
              gap < MAX_GAP_MS
            ) {
              last.push(m);
            } else {
              groups.push([m]);
            }
          }

          // Emit one synthesized Message per group (first-message id as key).
          for (const group of groups) {
            const first = group[0];
            if (!first) continue;
            const mapped = await toMessage(client, first, entity, selfId);
            const combinedText = group
              .map((g) => g.message ?? "")
              .filter((s) => s.length > 0)
              .join("\n");
            mapped.text = combinedText;
            mapped.is_unread = scanRead ? false : true;
            const last = group[group.length - 1];
            mapped.raw = {
              ...(mapped.raw ?? {}),
              collapsed: group.length > 1,
              message_count: group.length,
              message_ids: group.map((g) => String(g.id)),
              first_ts: new Date((first.date ?? 0) * 1000).toISOString(),
              last_ts: new Date((last?.date ?? 0) * 1000).toISOString(),
            };
            if (group.length > 1) collapsedGroups++;
            out.push(mapped);
            if (out.length >= cap) break;
          }
          if (out.length >= cap) break;
        }

        return json({
          filter_mode: filter.mode,
          mode: scanRead ? "include_read" : "unread_only",
          collapsed: collapse,
          stats: {
            raw_messages: rawMessages,
            units: out.length,
            collapsed_groups: collapsedGroups,
            dropped_already_replied: droppedReplied,
          },
          messages: out,
        });
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    "list_chats",
    {
      title: "List All Chats",
      description:
        "List all chats with their unread count and current filter flag (work / ignore / unset). Use for the `aide chats` workflow.",
      inputSchema: {
        limit: z.number().int().positive().max(200).default(100),
      },
    },
    async ({ limit }) => {
      try {
        const client = await getClient();
        const filter = await new FilesystemAdapter().loadChatFilter();

        const dialogs = await client.getDialogs({ limit });
        const out: Array<
          Chat & {
            unread_count: number;
            last_message_ts: string | null;
            flag: "work" | "ignore" | "unset";
          }
        > = [];

        for (const dialog of dialogs) {
          const entity = dialog.entity;
          const chat = toChat(entity);
          const entry = filter.chats.find((c) => c.id === chat.id);
          const lastTs =
            typeof dialog.date === "number" && dialog.date > 0
              ? new Date(dialog.date * 1000).toISOString()
              : null;
          out.push({
            ...chat,
            unread_count: dialog.unreadCount ?? 0,
            last_message_ts: lastTs,
            flag: entry?.flag ?? "unset",
          });
        }

        return json({
          filter_mode: filter.mode,
          chats: out,
        });
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    "get_chat_context",
    {
      title: "Get Chat Context",
      description:
        "Get the last N messages in a specific chat (newest first). chat_id is the Telegram peer id as a string.",
      inputSchema: {
        chat_id: z.string(),
        n: z.number().int().positive().max(100).default(10),
      },
    },
    async ({ chat_id, n }) => {
      try {
        const client = await getClient();
        const me = await client.getMe();
        const selfId = String((me as { id: unknown }).id ?? "");
        const entity = await client.getEntity(chat_id);
        const msgs = await client.getMessages(entity, { limit: n });
        const out: Message[] = [];
        for (const m of msgs) {
          if (!m) continue;
          out.push(await toMessage(client, m, entity, selfId));
        }
        return json(out);
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    "list_history",
    {
      title: "List Message History",
      description:
        "List messages from a chat within a time window, optionally filtering to only messages sent by the user (for style extraction).",
      inputSchema: {
        chat_id: z.string().optional(),
        from_self: z.boolean().optional(),
        since: z.string().optional(),
        limit: z.number().int().positive().max(500).default(100),
      },
    },
    async ({ chat_id, from_self, since, limit }) => {
      try {
        const client = await getClient();
        const me = await client.getMe();
        const selfId = String((me as { id: unknown }).id ?? "");
        const sinceTs = since ? new Date(since).getTime() : 0;

        const targets = chat_id
          ? [await client.getEntity(chat_id)]
          : (await client.getDialogs({ limit: 50 })).map((d) => d.entity);

        const out: Message[] = [];
        for (const entity of targets) {
          if (!entity) continue;
          const msgs = await client.getMessages(entity, {
            limit: Math.min(limit, 200),
          });
          for (const m of msgs) {
            if (!m) continue;
            const ts = (m.date ?? 0) * 1000;
            if (ts < sinceTs) continue;
            const mapped = await toMessage(client, m, entity, selfId);
            if (from_self === true && !mapped.sender.is_self) continue;
            out.push(mapped);
            if (out.length >= limit) break;
          }
          if (out.length >= limit) break;
        }

        return json(out);
      } catch (e) {
        return err(e);
      }
    },
  );

  if (!readOnly) {
    server.registerTool(
      "send_message",
      {
        title: "Send Message (⚠️ writes to Telegram)",
        description:
          "Send a message to a chat. Disabled by default — requires AIDE_TG_ALLOW_SEND=1 to enable.",
        inputSchema: {
          chat_id: z.string(),
          text: z.string(),
          reply_to_id: z.string().optional(),
        },
      },
      async ({ chat_id, text, reply_to_id }) => {
        try {
          if (process.env["AIDE_TG_ALLOW_SEND"] !== "1") {
            return err(
              "send_message is gated behind AIDE_TG_ALLOW_SEND=1 for safety.",
            );
          }
          const client = await getClient();
          const entity = await client.getEntity(chat_id);
          const opts: Parameters<typeof client.sendMessage>[1] = {
            message: text,
          };
          if (reply_to_id !== undefined) {
            opts.replyTo = Number(reply_to_id);
          }
          const sent = await client.sendMessage(entity, opts);
          return json({ ok: true, id: String(sent.id), chat_id });
        } catch (e) {
          return err(e);
        }
      },
    );
  }

  return server;
}
