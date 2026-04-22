import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { loadSession, readCreds } from "./session.js";
import {
  classifyEntity,
  getPeer,
  putPeer,
  type PeerEntry,
} from "./peer-cache.js";

let cached: TelegramClient | null = null;

export async function getClient(): Promise<TelegramClient> {
  if (cached) return cached;
  const { apiId, apiHash } = readCreds();
  const sessionString = await loadSession();
  if (sessionString.length === 0) {
    throw new Error(
      "No Telegram session found. Run `aide init` (or `pnpm --filter @aide-os/mcp-telegram login`) to create one.",
    );
  }
  const session = new StringSession(sessionString);
  const client = new TelegramClient(session, apiId, apiHash, {
    connectionRetries: 5,
    useWSS: false,
  });
  client.setLogLevel("error" as never);
  await client.connect();
  const ok = await client.checkAuthorization();
  if (!ok) {
    throw new Error(
      "Telegram session is not authorized. Re-run `aide init` to refresh.",
    );
  }
  cached = client;
  return client;
}

export async function closeClient(): Promise<void> {
  if (cached) {
    try {
      await cached.disconnect();
    } catch {
      // ignore
    }
    cached = null;
  }
}

/**
 * Cache every entity seen via getDialogs so subsequent getEntity() calls can
 * resolve by id without hitting Telegram's peer-resolution path (which
 * occasionally fails for supergroups requesting access_hash).
 */
export async function populatePeerCacheFromDialogs(
  client: TelegramClient,
  limit = 200,
): Promise<number> {
  const dialogs = await client.getDialogs({ limit });
  let count = 0;
  const now = new Date().toISOString();
  for (const d of dialogs) {
    const ent = d.entity;
    if (!ent) continue;
    const id = String((ent as { id?: unknown }).id ?? "");
    if (!id) continue;
    const nameFromPerson = [
      (ent as { firstName?: string }).firstName ?? "",
      (ent as { lastName?: string }).lastName ?? "",
    ]
      .join(" ")
      .trim();
    const title =
      (ent as { title?: string }).title ??
      (nameFromPerson.length > 0
        ? nameFromPerson
        : (ent as { username?: string }).username ?? "(unknown)");
    const rawHash = (ent as { accessHash?: unknown }).accessHash;
    const entry: PeerEntry = {
      id,
      type: classifyEntity(ent),
      title,
      updated_at: now,
      ...(rawHash !== undefined && rawHash !== null
        ? { access_hash: String(rawHash) }
        : {}),
      ...((ent as { username?: string }).username !== undefined
        ? { username: (ent as { username: string }).username }
        : {}),
    };
    await putPeer(entry);
    count++;
  }
  return count;
}

/**
 * Resolve an entity by numeric string id, preferring the peer cache. Falls
 * back to gramjs.getEntity and repopulates the cache from dialogs if the
 * direct lookup fails — a pattern that dodges the "peer resolution failed"
 * class of errors on supergroups.
 */
export async function resolveEntity(
  client: TelegramClient,
  chatId: string,
): Promise<Api.TypeEntityLike> {
  // Try gramjs first (fast when it works and when user typed a @username).
  try {
    return await client.getEntity(chatId);
  } catch {
    // fall through
  }
  const cached = await getPeer(chatId);
  if (cached && cached.access_hash) {
    // Rebuild the InputPeer from cached access_hash.
    const id = BigInt(cached.id);
    const hash = BigInt(cached.access_hash);
    if (cached.type === "channel") {
      return new Api.InputPeerChannel({
        channelId: id as unknown as bigInt.BigInteger,
        accessHash: hash as unknown as bigInt.BigInteger,
      });
    }
    if (cached.type === "user") {
      return new Api.InputPeerUser({
        userId: id as unknown as bigInt.BigInteger,
        accessHash: hash as unknown as bigInt.BigInteger,
      });
    }
    if (cached.type === "chat") {
      return new Api.InputPeerChat({
        chatId: id as unknown as bigInt.BigInteger,
      });
    }
  }
  // Last resort: refresh cache from dialogs then try once more.
  await populatePeerCacheFromDialogs(client, 300);
  return await client.getEntity(chatId);
}
