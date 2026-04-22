import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export interface BotConfig {
  bot_token: string;
  owner_id: number;
  /**
   * chat_id where the bot DMs the owner — normally same as owner_id for private chats,
   * but captured at /start time in case of future group usage.
   */
  owner_chat_id: number;
}

export function configDir(): string {
  const xdg = process.env["XDG_CONFIG_HOME"];
  const base = xdg && xdg.length > 0 ? xdg : join(homedir(), ".config");
  return join(base, "aide");
}

export function configPath(): string {
  return join(configDir(), "bot.json");
}

export async function readConfig(): Promise<BotConfig | null> {
  const p = configPath();
  if (!existsSync(p)) return null;
  const raw = await readFile(p, "utf8");
  return JSON.parse(raw) as BotConfig;
}

export async function writeConfig(cfg: BotConfig): Promise<void> {
  const p = configPath();
  const dir = dirname(p);
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
  await writeFile(p, JSON.stringify(cfg, null, 2), {
    encoding: "utf8",
    mode: 0o600,
  });
}

export function readTokenFromEnv(): string | null {
  return process.env["AIDE_BOT_TOKEN"] ?? null;
}

export function readOwnerFromEnv(): number | null {
  const v = process.env["AIDE_BOT_OWNER_ID"];
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
