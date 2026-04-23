import kleur from "kleur";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname } from "node:path";
import { envFilePath } from "../paths.js";

async function readEnvRaw(): Promise<string> {
  const p = envFilePath();
  if (!existsSync(p)) return "";
  return await readFile(p, "utf8");
}

function extractVar(raw: string, key: string): string | null {
  const m = raw.match(new RegExp(`^${key}=(.*)$`, "m"));
  if (!m) return null;
  return (m[1] ?? "").replace(/^["']|["']$/g, "").trim();
}

async function upsertVar(key: string, value: string | null): Promise<void> {
  const p = envFilePath();
  const dir = dirname(p);
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
  const raw = await readEnvRaw();
  const filtered = raw
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0 && !new RegExp(`^${key}=`).test(l));
  if (value !== null && value.length > 0) filtered.push(`${key}=${value}`);
  await writeFile(p, filtered.join("\n") + "\n", {
    encoding: "utf8",
    mode: 0o600,
  });
}

/** `claude mcp list` and grep for the notion line's auth state. */
function checkAuth(): Promise<"ok" | "needs-auth" | "unknown"> {
  return new Promise((resolve) => {
    const child = spawn("claude", ["mcp", "list"], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    child.stdout?.on("data", (d) => (out += d.toString()));
    child.on("exit", () => {
      const line = out.split("\n").find((l) => /notion/i.test(l)) ?? "";
      if (line.includes("Needs authentication")) resolve("needs-auth");
      else if (line.includes("Connected")) resolve("ok");
      else resolve("unknown");
    });
    child.on("error", () => resolve("unknown"));
  });
}

export async function notionStatusCommand(): Promise<number> {
  const auth = await checkAuth();
  const raw = await readEnvRaw();
  const db = extractVar(raw, "AIDE_NOTION_TASKS_DB");
  const briefs = extractVar(raw, "AIDE_NOTION_BRIEFS_PAGE");
  const emoji = (ok: boolean) => (ok ? kleur.green("✓") : kleur.red("✗"));
  console.log(kleur.bold("\naide notion status\n"));
  console.log(
    `  ${emoji(auth === "ok")} Notion MCP auth        ${kleur.dim(auth)}`,
  );
  console.log(
    `  ${emoji(db !== null)} tasks DB configured    ${kleur.dim(db ?? "(unset — `aide notion set-tasks-db <id>`)")}`,
  );
  console.log(
    `  ${emoji(briefs !== null)} briefs archive page    ${kleur.dim(briefs ?? "(unset — `aide notion set-briefs-page <id>`)")}`,
  );
  if (auth !== "ok") {
    console.log(
      kleur.dim(
        "\nTo authenticate, run `claude` in any terminal and tap the Notion MCP prompt, or follow the OAuth link it surfaces.",
      ),
    );
  }
  return 0;
}

export async function notionSetTasksDbCommand(
  id: string | undefined,
): Promise<number> {
  if (!id) {
    console.error(kleur.red("Usage: aide notion set-tasks-db <database_id>"));
    console.error(
      kleur.dim(
        "\nFind the id by opening the database in Notion, clicking ••• → Copy link. The id is the 32-char hex after the slash (before the ?). e.g. https://notion.so/YourDB-abcdef0123456789… → id = abcdef0123456789…",
      ),
    );
    return 1;
  }
  const cleaned = id.replace(/[^0-9a-fA-F-]/g, "");
  if (cleaned.length < 32) {
    console.error(
      kleur.red(
        `That doesn't look like a Notion database id (expected ≥ 32 hex chars, got ${cleaned.length}).`,
      ),
    );
    return 1;
  }
  await upsertVar("AIDE_NOTION_TASKS_DB", cleaned);
  console.log(kleur.green(`✓ tasks DB set to ${cleaned}`));
  console.log(
    kleur.dim(
      "\nNext `aide run task` will sync new Task records to this database.",
    ),
  );
  return 0;
}

export async function notionClearTasksDbCommand(): Promise<number> {
  await upsertVar("AIDE_NOTION_TASKS_DB", null);
  console.log(kleur.green("✓ tasks DB cleared"));
  return 0;
}

export async function notionSetBriefsPageCommand(
  id: string | undefined,
): Promise<number> {
  if (!id) {
    console.error(kleur.red("Usage: aide notion set-briefs-page <page_id>"));
    return 1;
  }
  const cleaned = id.replace(/[^0-9a-fA-F-]/g, "");
  if (cleaned.length < 32) {
    console.error(
      kleur.red(
        `That doesn't look like a Notion page id (expected ≥ 32 hex chars).`,
      ),
    );
    return 1;
  }
  await upsertVar("AIDE_NOTION_BRIEFS_PAGE", cleaned);
  console.log(kleur.green(`✓ briefs parent page set to ${cleaned}`));
  return 0;
}

export async function notionClearBriefsPageCommand(): Promise<number> {
  await upsertVar("AIDE_NOTION_BRIEFS_PAGE", null);
  console.log(kleur.green("✓ briefs parent page cleared"));
  return 0;
}
