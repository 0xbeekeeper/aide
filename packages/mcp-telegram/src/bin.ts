#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createTelegramServer } from "./server.js";
import { closeClient } from "./client.js";

async function main() {
  const allowSend = process.env["COS_TG_ALLOW_SEND"] === "1";
  const server = createTelegramServer({ readOnly: !allowSend });
  const transport = new StdioServerTransport();
  await server.connect(transport);

  const shutdown = async () => {
    await closeClient();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("mcp-telegram failed to start:", err);
  process.exit(1);
});
