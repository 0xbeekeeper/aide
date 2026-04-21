import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { loadSession, readCreds } from "./session.js";

let cached: TelegramClient | null = null;

export async function getClient(): Promise<TelegramClient> {
  if (cached) return cached;
  const { apiId, apiHash } = readCreds();
  const sessionString = await loadSession();
  if (sessionString.length === 0) {
    throw new Error(
      "No Telegram session found. Run `cos init` (or `pnpm --filter @chief-of-staff/mcp-telegram login`) to create one.",
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
      "Telegram session is not authorized. Re-run `cos init` to refresh.",
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
