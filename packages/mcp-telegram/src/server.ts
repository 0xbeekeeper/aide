import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getClient } from "./client.js";
import { toMessage } from "./map.js";
import type { Message } from "@chief-of-staff/types";

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
    name: opts.name ?? "chief-of-staff-telegram",
    version: opts.version ?? "0.0.0",
  });

  server.registerTool(
    "list_unread",
    {
      title: "List Unread Messages",
      description:
        "List unread messages across all chats. since = ISO 8601 lower bound; limit caps total returned messages.",
      inputSchema: {
        since: z.string().optional(),
        limit: z.number().int().positive().max(200).optional(),
      },
    },
    async ({ since, limit }) => {
      try {
        const client = await getClient();
        const me = await client.getMe();
        const selfId = String((me as { id: unknown }).id ?? "");
        const sinceTs = since ? new Date(since).getTime() : 0;
        const cap = limit ?? 50;

        const dialogs = await client.getDialogs({ limit: 100 });
        const out: Message[] = [];

        for (const dialog of dialogs) {
          const unread = dialog.unreadCount ?? 0;
          if (unread <= 0) continue;
          const entity = dialog.entity;
          const msgs = await client.getMessages(entity, { limit: unread });
          for (const m of msgs) {
            if (!m) continue;
            const ts = (m.date ?? 0) * 1000;
            if (ts < sinceTs) continue;
            const mapped = await toMessage(client, m, entity, selfId);
            mapped.is_unread = true;
            out.push(mapped);
            if (out.length >= cap) break;
          }
          if (out.length >= cap) break;
        }

        return json(out);
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
          "Send a message to a chat. Disabled by default — requires COS_TG_ALLOW_SEND=1 to enable.",
        inputSchema: {
          chat_id: z.string(),
          text: z.string(),
          reply_to_id: z.string().optional(),
        },
      },
      async ({ chat_id, text, reply_to_id }) => {
        try {
          if (process.env["COS_TG_ALLOW_SEND"] !== "1") {
            return err(
              "send_message is gated behind COS_TG_ALLOW_SEND=1 for safety.",
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
