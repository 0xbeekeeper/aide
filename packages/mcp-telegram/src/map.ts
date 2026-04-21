import type { Message, Chat, Sender } from "@chief-of-staff/types";
import type { TelegramClient } from "telegram";
import type { Api } from "telegram";

// gramjs returns several entity shapes — we accept any and narrow at runtime.
type AnyEntity = unknown;

function bigIntStr(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (typeof v === "bigint") return v.toString();
  const maybeToString = (v as { toString?: () => string }).toString;
  if (typeof maybeToString === "function") return maybeToString.call(v);
  return String(v);
}

function className(entity: AnyEntity): string {
  const c = (entity as { className?: unknown } | null)?.className;
  return typeof c === "string" ? c : "";
}

function chatKind(entity: AnyEntity): Chat["kind"] {
  const c = className(entity);
  if (c === "User" || c === "UserEmpty") return "private";
  if (c === "Chat" || c === "ChatForbidden" || c === "ChatEmpty") return "group";
  if (c === "Channel" || c === "ChannelForbidden") {
    const megagroup = (entity as { megagroup?: boolean }).megagroup;
    return megagroup ? "group" : "channel";
  }
  return "private";
}

function chatTitle(entity: AnyEntity): string {
  if (!entity) return "(unknown)";
  const c = className(entity);
  if (c === "User" || c === "UserEmpty") {
    const u = entity as { firstName?: string; lastName?: string; username?: string };
    const name = `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim();
    if (name.length > 0) return name;
    if (u.username) return `@${u.username}`;
    return "(private)";
  }
  const title = (entity as { title?: string }).title;
  return typeof title === "string" && title.length > 0 ? title : "(chat)";
}

export function toChat(entity: AnyEntity): Chat {
  return {
    id: bigIntStr((entity as { id?: unknown } | null)?.id),
    platform: "telegram",
    title: chatTitle(entity),
    kind: chatKind(entity),
  };
}

export function toSender(user: Api.User | undefined, isSelf: boolean): Sender {
  if (!user) {
    return {
      id: "",
      display_name: "(unknown)",
      is_self: isSelf,
    };
  }
  const name = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
  return {
    id: bigIntStr(user.id),
    display_name: name.length > 0 ? name : (user.username ?? "(anon)"),
    ...(user.username ? { username: user.username } : {}),
    is_self: isSelf,
  };
}

export async function toMessage(
  client: TelegramClient,
  msg: Api.Message,
  chatEntity: AnyEntity,
  selfId: string,
): Promise<Message> {
  const chat = toChat(chatEntity);

  let senderEntity: Api.User | undefined;
  if (msg.senderId) {
    try {
      const ent = await client.getEntity(msg.senderId);
      if (className(ent) === "User") senderEntity = ent as Api.User;
    } catch {
      // ignore
    }
  }

  const senderIdStr = bigIntStr(msg.senderId);
  const sender = toSender(senderEntity, senderIdStr === selfId);

  return {
    id: bigIntStr(msg.id),
    chat,
    sender,
    text: msg.message ?? "",
    ts: new Date((msg.date ?? 0) * 1000).toISOString(),
    ...(msg.replyTo && "replyToMsgId" in msg.replyTo
      ? { reply_to_id: bigIntStr(msg.replyTo.replyToMsgId) }
      : {}),
    is_unread: false,
    has_media: Boolean(msg.media),
  };
}
