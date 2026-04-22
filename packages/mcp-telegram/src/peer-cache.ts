import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export interface PeerEntry {
  id: string;
  type: "user" | "chat" | "channel" | "unknown";
  access_hash?: string;
  username?: string;
  title: string;
  updated_at: string;
}

export interface PeerCache {
  version: 1;
  peers: Record<string, PeerEntry>;
}

function cachePath(): string {
  const xdg = process.env["XDG_CONFIG_HOME"];
  const base = xdg && xdg.length > 0 ? xdg : join(homedir(), ".config");
  return join(base, "aide", "peer-cache.json");
}

let memo: PeerCache | null = null;

export async function loadCache(): Promise<PeerCache> {
  if (memo) return memo;
  const p = cachePath();
  if (!existsSync(p)) {
    memo = { version: 1, peers: {} };
    return memo;
  }
  try {
    memo = JSON.parse(await readFile(p, "utf8")) as PeerCache;
    if (!memo || memo.version !== 1) memo = { version: 1, peers: {} };
  } catch {
    memo = { version: 1, peers: {} };
  }
  return memo;
}

export async function saveCache(cache: PeerCache): Promise<void> {
  memo = cache;
  const p = cachePath();
  const dir = dirname(p);
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
  await writeFile(p, JSON.stringify(cache, null, 2), {
    encoding: "utf8",
    mode: 0o600,
  });
}

export async function putPeer(entry: PeerEntry): Promise<void> {
  const c = await loadCache();
  c.peers[entry.id] = entry;
  await saveCache(c);
}

export async function getPeer(id: string): Promise<PeerEntry | null> {
  const c = await loadCache();
  return c.peers[id] ?? null;
}

/**
 * Classify a gramjs entity into our simplified type.  Accepts the `className`
 * that gramjs attaches to every entity.
 */
export function classifyEntity(entity: unknown): PeerEntry["type"] {
  const c = (entity as { className?: unknown })?.className;
  if (typeof c !== "string") return "unknown";
  if (c === "User" || c === "UserEmpty") return "user";
  if (c === "Chat" || c === "ChatEmpty" || c === "ChatForbidden") return "chat";
  if (c === "Channel" || c === "ChannelForbidden") return "channel";
  return "unknown";
}
