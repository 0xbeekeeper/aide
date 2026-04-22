#!/usr/bin/env node
import { Command } from "commander";
import { runCommand } from "./commands/run.js";
import { doctorCommand } from "./commands/doctor.js";
import { initCommand } from "./commands/init.js";
import { statusCommand } from "./commands/status.js";
import { printMcpConfigCommand } from "./commands/print-mcp-config.js";
import type { Runtime } from "./runtime.js";

const program = new Command();
program
  .name("aide")
  .description("aide — your AI work copilot")
  .version("0.0.0");

program
  .command("init")
  .description("first-time setup: credentials + Telegram login")
  .action(async () => process.exit(await initCommand()));

program
  .command("run [skill]")
  .description("run a skill (triage | reply | task | brief | extract-style)")
  .option("-r, --runtime <rt>", "force runtime: claude-code | openclaw | manual")
  .action(async (skill: string | undefined, opts: { runtime?: Runtime }) => {
    process.exit(
      await runCommand(skill, opts.runtime ? { runtime: opts.runtime } : {}),
    );
  });

program
  .command("doctor")
  .description("check configuration and dependencies")
  .action(async () => process.exit(await doctorCommand()));

program
  .command("status")
  .description("show hub state summary")
  .action(async () => process.exit(await statusCommand()));

program
  .command("print-mcp-config [target]")
  .description("print an MCP config snippet (claude-code | openclaw | cursor)")
  .action(async (target: string | undefined) =>
    process.exit(await printMcpConfigCommand(target)),
  );

program.parseAsync(process.argv).catch((err) => {
  console.error(err);
  process.exit(1);
});
