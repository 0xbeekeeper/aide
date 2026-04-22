import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

export type Runtime = "claude-code" | "openclaw" | "manual";

export function detectRuntime(): Runtime {
  if (which("claude")) return "claude-code";
  if (which("openclaw")) return "openclaw";
  return "manual";
}

function which(bin: string): string | null {
  const path = process.env["PATH"] ?? "";
  for (const dir of path.split(":")) {
    if (!dir) continue;
    const candidate = `${dir}/${bin}`;
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

export async function runClaudeCode(prompt: string): Promise<number> {
  // bypassPermissions is required for non-interactive runs — without it,
  // unapproved MCP tool calls block forever waiting on a permission prompt
  // that stdin can't answer. Since aide's MCPs are all user-installed and
  // trusted, granting them blanket permission is safe at the CLI boundary.
  return new Promise((resolve) => {
    const child = spawn(
      "claude",
      ["-p", "--permission-mode", "bypassPermissions", prompt],
      { stdio: "inherit", env: process.env },
    );
    child.on("exit", (code) => resolve(code ?? 0));
    child.on("error", (err) => {
      console.error("failed to spawn claude:", err);
      resolve(1);
    });
  });
}

export function manualInstructions(skillName: string, prompt: string): string {
  return [
    "",
    "No compatible agent runtime detected on PATH (tried: claude, openclaw).",
    "",
    "To run this skill manually, open your agent host and paste:",
    "",
    `  "${prompt}"`,
    "",
    `The host must have the '${skillName}' skill installed and the`,
    "aide-hub / aide-telegram MCP servers configured.",
    "",
    "See docs/install-claude-code.md for setup instructions.",
    "",
  ].join("\n");
}
