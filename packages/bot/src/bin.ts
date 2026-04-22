#!/usr/bin/env node
import kleur from "kleur";
import { createBot } from "./bot.js";
import { readConfig, writeConfig } from "./config.js";
import { pushAllPending } from "./push.js";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { Bot } from "grammy";

function configDirPath(): string {
  const xdg = process.env["XDG_CONFIG_HOME"];
  const base = xdg && xdg.length > 0 ? xdg : join(homedir(), ".config");
  return join(base, "aide");
}

async function loadEnvFile(): Promise<Record<string, string>> {
  const p = join(configDirPath(), ".env");
  if (!existsSync(p)) return {};
  const raw = await readFile(p, "utf8");
  const out: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && m[1] && m[2] !== undefined) {
      out[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  return out;
}

async function saveEnvFile(update: Record<string, string>): Promise<void> {
  const p = join(configDirPath(), ".env");
  const dir = dirname(p);
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
  const existing = await loadEnvFile();
  const merged = { ...existing, ...update };
  const body = Object.entries(merged)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  await writeFile(p, body + "\n", { encoding: "utf8", mode: 0o600 });
}

async function prompt(q: string): Promise<string> {
  const readline = await import("node:readline");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(q, (a) => {
      rl.close();
      resolve(a);
    });
  });
}

async function cmdSetup(): Promise<number> {
  console.log(kleur.bold("\n▶ aide bot setup\n"));
  console.log(
    "Step 1: create your bot via @BotFather in Telegram (/newbot).\n" +
      "        Copy the token it gives you — looks like  1234567890:ABC…\n",
  );

  const env = await loadEnvFile();
  const defaultToken = env["AIDE_BOT_TOKEN"] ?? "";
  const tokenInput = (
    await prompt(
      `AIDE_BOT_TOKEN${defaultToken ? ` [${defaultToken.slice(0, 10)}…]` : ""}: `,
    )
  ).trim();
  const token = tokenInput || defaultToken;
  if (!token) {
    console.error(kleur.red("token is required."));
    return 1;
  }

  console.log(
    kleur.dim(
      "\nStep 2: find out your Telegram user_id. Easiest way: send /start to your bot now,\n" +
        "        and I'll grab the first update from that.\n",
    ),
  );

  const tmpBot = new Bot(token);
  console.log(
    kleur.cyan(`  → open Telegram, find your bot, send it the message:  /start`),
  );
  console.log(kleur.dim(`    (waiting up to 120s for the first update…)`));

  let ownerId: number | null = null;
  let ownerChatId: number | null = null;
  tmpBot.command("start", async (ctx) => {
    const fromId = ctx.from?.id;
    const chatId = ctx.chat.id;
    if (fromId !== undefined) {
      ownerId = fromId;
      ownerChatId = chatId;
      await ctx.reply(
        `✓ captured: user_id=${fromId}, chat_id=${chatId}.\nRun-once setup complete — you can now start aide-bot proper.`,
      );
      await tmpBot.stop();
    }
  });

  const timer = setTimeout(() => {
    console.error(kleur.red("\n✗ timed out waiting for /start."));
    tmpBot.stop().catch(() => {});
  }, 120_000);

  try {
    await tmpBot.start({ drop_pending_updates: true });
  } catch {
    // Bot.stop() cancels the long-polling loop, which bubbles an abort — treat as normal.
  }
  clearTimeout(timer);

  if (ownerId === null || ownerChatId === null) {
    console.error(
      kleur.red(
        "\ncould not capture owner_id. Re-run `aide bot setup` and send /start promptly.",
      ),
    );
    return 1;
  }

  await writeConfig({
    bot_token: token,
    owner_id: ownerId,
    owner_chat_id: ownerChatId,
  });
  await saveEnvFile({
    AIDE_BOT_TOKEN: token,
    AIDE_BOT_OWNER_ID: String(ownerId),
  });

  console.log(
    kleur.green(
      `\n✓ saved config. next: \`aide-bot start\` (or \`aide-bot push-pending\` to test).`,
    ),
  );
  return 0;
}

async function cmdStart(): Promise<number> {
  const env = await loadEnvFile();
  for (const [k, v] of Object.entries(env)) {
    if (process.env[k] === undefined) process.env[k] = v;
  }
  const cfg = await readConfig();
  if (!cfg) {
    console.error(
      kleur.red("bot not configured. Run `aide-bot setup` first."),
    );
    return 1;
  }
  const bot = createBot({ token: cfg.bot_token, ownerId: cfg.owner_id });
  console.log(
    kleur.green(
      `▶ aide-bot running (owner_id=${cfg.owner_id}). Ctrl+C to stop.`,
    ),
  );
  const stop = () => {
    bot.stop();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  await bot.start({ drop_pending_updates: true });
  return 0;
}

async function cmdPushPending(): Promise<number> {
  const env = await loadEnvFile();
  for (const [k, v] of Object.entries(env)) {
    if (process.env[k] === undefined) process.env[k] = v;
  }
  const cfg = await readConfig();
  if (!cfg) {
    console.error(
      kleur.red("bot not configured. Run `aide-bot setup` first."),
    );
    return 1;
  }
  const bot = new Bot(cfg.bot_token);
  const { pushed, skipped, auto_resolved } = await pushAllPending(bot);
  console.log(
    kleur.green(
      `✓ pushed ${pushed} card(s); skipped ${skipped}; auto-resolved ${auto_resolved} (already replied).`,
    ),
  );
  return 0;
}

async function main() {
  const cmd = process.argv[2];
  let code: number;
  if (cmd === "setup") code = await cmdSetup();
  else if (cmd === "start") code = await cmdStart();
  else if (cmd === "push-pending") code = await cmdPushPending();
  else {
    console.log(
      "Usage: aide-bot <setup | start | push-pending>\n\n" +
        "  setup          one-time: save token + owner_id\n" +
        "  start          run the bot in the foreground (handles cards)\n" +
        "  push-pending   send a card for each pending draft in the hub\n",
    );
    code = cmd ? 1 : 0;
  }
  process.exit(code);
}

main().catch((e) => {
  console.error(kleur.red(e instanceof Error ? e.message : String(e)));
  process.exit(1);
});
