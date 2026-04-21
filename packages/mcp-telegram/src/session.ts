import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export function sessionPath(): string {
  const xdg = process.env["XDG_CONFIG_HOME"];
  const base = xdg && xdg.length > 0 ? xdg : join(homedir(), ".config");
  return join(base, "chief-of-staff", "telegram.session");
}

export async function loadSession(): Promise<string> {
  const p = sessionPath();
  if (!existsSync(p)) return "";
  return (await readFile(p, "utf8")).trim();
}

export async function saveSession(session: string): Promise<void> {
  const p = sessionPath();
  const dir = dirname(p);
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
  await writeFile(p, session, { encoding: "utf8", mode: 0o600 });
}

export interface TgCreds {
  apiId: number;
  apiHash: string;
}

export function readCreds(): TgCreds {
  const apiIdStr = process.env["TG_API_ID"];
  const apiHash = process.env["TG_API_HASH"];
  if (!apiIdStr || !apiHash) {
    throw new Error(
      "Missing TG_API_ID / TG_API_HASH env vars. Get them at https://my.telegram.org then run `cos init`.",
    );
  }
  const apiId = Number(apiIdStr);
  if (!Number.isFinite(apiId) || apiId <= 0) {
    throw new Error(`TG_API_ID must be a positive integer, got: ${apiIdStr}`);
  }
  return { apiId, apiHash };
}
