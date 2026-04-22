#!/usr/bin/env node
import { Command } from "commander";
import { runCommand } from "./commands/run.js";
import { doctorCommand } from "./commands/doctor.js";
import { initCommand } from "./commands/init.js";
import { statusCommand } from "./commands/status.js";
import { printMcpConfigCommand } from "./commands/print-mcp-config.js";
import {
  chatsListCommand,
  chatsWorkCommand,
  chatsIgnoreCommand,
  chatsResetCommand,
  chatsModeCommand,
} from "./commands/chats.js";
import {
  draftsListCommand,
  draftsShowCommand,
  draftsMarkSentCommand,
} from "./commands/drafts.js";
import { langCommand } from "./commands/lang.js";
import {
  profileShowCommand,
  profileEditCommand,
  profileResetCommand,
} from "./commands/profile.js";
import {
  installLaunchdCommand,
  uninstallLaunchdCommand,
} from "./commands/install-launchd.js";
import {
  notionStatusCommand,
  notionSetTasksDbCommand,
  notionClearTasksDbCommand,
} from "./commands/notion.js";
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

const chats = program
  .command("chats")
  .description("manage the work/ignore chat filter applied to list_unread");

chats
  .command("list", { isDefault: true })
  .description("list all chats with current filter flags")
  .action(async () => process.exit(await chatsListCommand()));

chats
  .command("work <ids...>")
  .description("mark chats as work (kept under whitelist mode)")
  .action(async (ids: string[]) => process.exit(await chatsWorkCommand(ids)));

chats
  .command("ignore <ids...>")
  .description("mark chats as ignore (dropped under blacklist mode)")
  .action(async (ids: string[]) =>
    process.exit(await chatsIgnoreCommand(ids)),
  );

chats
  .command("reset <ids...>")
  .description("clear work/ignore flag for chats")
  .action(async (ids: string[]) => process.exit(await chatsResetCommand(ids)));

chats
  .command("mode <mode>")
  .description("set filter mode: whitelist | blacklist | off")
  .action(async (mode: string) => process.exit(await chatsModeCommand(mode)));

const drafts = program
  .command("drafts")
  .description("review reply drafts before copying them into Telegram");

drafts
  .command("list", { isDefault: true })
  .description("list pending drafts with source + reasoning")
  .option("-a, --all", "include drafts already marked as sent")
  .option("-v, --verbose", "show the 'why' reasoning under each draft")
  .action(async (opts: { all?: boolean; verbose?: boolean }) =>
    process.exit(await draftsListCommand(opts)),
  );

drafts
  .command("show <messageId>")
  .description("show all drafts for one message_id with full reasoning")
  .action(async (messageId: string) =>
    process.exit(await draftsShowCommand(messageId)),
  );

drafts
  .command("mark-sent <draftId>")
  .description("mark a draft as sent (records timestamp)")
  .action(async (draftId: string) =>
    process.exit(await draftsMarkSentCommand(draftId)),
  );

program
  .command("lang [value]")
  .description("show or set language preference (en | zh)")
  .action(async (value: string | undefined) =>
    process.exit(await langCommand(value)),
  );

const profile = program
  .command("profile")
  .description("manage your persona + triage rubric (injected into every run)");

profile
  .command("show", { isDefault: true })
  .description("print the current profile")
  .action(async () => process.exit(await profileShowCommand()));

profile
  .command("edit")
  .description("open ~/.config/aide/profile.md in $EDITOR")
  .action(async () => process.exit(await profileEditCommand()));

profile
  .command("reset")
  .description("overwrite profile with a starter template")
  .action(async () => process.exit(await profileResetCommand()));

program
  .command("install-launchd")
  .description(
    "install macOS launchd agents: triage every 15 min + brief every morning 8:30",
  )
  .action(async () => process.exit(await installLaunchdCommand()));

program
  .command("uninstall-launchd")
  .description("remove the launchd agents installed by install-launchd")
  .action(async () => process.exit(await uninstallLaunchdCommand()));

const notion = program
  .command("notion")
  .description("Notion integration — check auth, point at a tasks DB");

notion
  .command("status", { isDefault: true })
  .description("show Notion MCP auth + configured tasks DB")
  .action(async () => process.exit(await notionStatusCommand()));

notion
  .command("set-tasks-db <id>")
  .description("tell aide-task which Notion database to sync tasks into")
  .action(async (id: string) =>
    process.exit(await notionSetTasksDbCommand(id)),
  );

notion
  .command("clear-tasks-db")
  .description("forget the tasks DB — stop syncing tasks to Notion")
  .action(async () => process.exit(await notionClearTasksDbCommand()));

program.parseAsync(process.argv).catch((err) => {
  console.error(err);
  process.exit(1);
});
