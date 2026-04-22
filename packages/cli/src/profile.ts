import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { configDir } from "./paths.js";

export function profilePath(): string {
  return join(configDir(), "profile.md");
}

export async function readProfile(): Promise<string | null> {
  const p = profilePath();
  if (!existsSync(p)) return null;
  return (await readFile(p, "utf8")).trim();
}

export async function writeProfile(content: string): Promise<void> {
  const p = profilePath();
  const dir = dirname(p);
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
  await writeFile(p, content.trim() + "\n", {
    encoding: "utf8",
    mode: 0o600,
  });
}

/**
 * If a profile exists, wrap it into a USER PROFILE block and return the new
 * prompt body.  Otherwise return the original prompt unchanged.
 */
export async function enrichWithProfile(prompt: string): Promise<string> {
  const profile = await readProfile();
  if (!profile) return prompt;
  return [
    "You have access to a USER PROFILE below. It describes the user's role,",
    "triage rubric, reply voice, and things to avoid. Honor it throughout —",
    "it overrides the skill's defaults where they conflict.",
    "",
    "<user_profile>",
    profile,
    "</user_profile>",
    "",
    prompt,
  ].join("\n");
}
