import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname } from "node:path";
import { envFilePath } from "./paths.js";

export interface EnvFile {
  TG_API_ID?: string;
  TG_API_HASH?: string;
  COS_STORAGE?: "filesystem" | "notion";
  COS_TG_ALLOW_SEND?: "0" | "1";
}

export async function loadEnv(): Promise<EnvFile> {
  const p = envFilePath();
  if (!existsSync(p)) return {};
  const raw = await readFile(p, "utf8");
  const out: EnvFile = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    (out as Record<string, string>)[key] = val;
  }
  return out;
}

export async function saveEnv(env: EnvFile): Promise<void> {
  const p = envFilePath();
  const dir = dirname(p);
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
  const lines = Object.entries(env)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k}=${v}`);
  await writeFile(p, `${lines.join("\n")}\n`, { encoding: "utf8", mode: 0o600 });
}

export function applyEnvToProcess(env: EnvFile): void {
  for (const [k, v] of Object.entries(env)) {
    if (v !== undefined && v !== null && v !== "") {
      if (process.env[k] === undefined) process.env[k] = String(v);
    }
  }
}
