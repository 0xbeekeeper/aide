#!/usr/bin/env node
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import input from "input";
import { readCreds, saveSession, sessionPath } from "./session.js";

async function main() {
  const { apiId, apiHash } = readCreds();

  console.log("\n▶ chief-of-staff — Telegram login\n");
  console.log(
    "This signs you in with a Telegram *user* session (not a bot).\n" +
      "Your session string will be saved at:",
    sessionPath(),
    "\n",
  );

  const session = new StringSession("");
  const client = new TelegramClient(session, apiId, apiHash, {
    connectionRetries: 5,
  });
  client.setLogLevel("error" as never);

  await client.start({
    phoneNumber: async () => await input.text("Phone (e.g. +1234567890): "),
    password: async () =>
      await input.password("2FA password (leave empty if none): "),
    phoneCode: async () =>
      await input.text("Code from Telegram: "),
    onError: (err) => console.error(err),
  });

  const sessionString = String(client.session.save());
  await saveSession(sessionString);
  await client.disconnect();

  console.log("\n✓ Session saved. You can now run `cos run triage`.\n");
}

main().catch((err) => {
  console.error("login failed:", err);
  process.exit(1);
});
