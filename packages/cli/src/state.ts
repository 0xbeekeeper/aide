import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { configDir } from "./paths.js";

export interface AideState {
  last_triage_at?: string;
}

export function statePath(): string {
  return join(configDir(), "state.json");
}

export async function readState(): Promise<AideState> {
  const p = statePath();
  if (!existsSync(p)) return {};
  try {
    return JSON.parse(await readFile(p, "utf8")) as AideState;
  } catch {
    return {};
  }
}

export async function writeState(state: AideState): Promise<void> {
  const p = statePath();
  const dir = dirname(p);
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
  await writeFile(p, JSON.stringify(state, null, 2), {
    encoding: "utf8",
    mode: 0o600,
  });
}
