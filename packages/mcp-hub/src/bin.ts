#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createHubServer } from "./server.js";

async function main() {
  const server = createHubServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("mcp-hub failed to start:", err);
  process.exit(1);
});
