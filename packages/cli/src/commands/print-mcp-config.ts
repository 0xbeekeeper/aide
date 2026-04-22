import kleur from "kleur";
import { loadEnv } from "../env.js";

export async function printMcpConfigCommand(
  target: string | undefined,
): Promise<number> {
  const env = await loadEnv();
  const t = target ?? "claude-code";

  const hub = { command: "aide-mcp-hub", args: [] as string[] };
  const tg = {
    command: "aide-mcp-telegram",
    args: [] as string[],
    env: {
      TG_API_ID: env.TG_API_ID ?? "<set me>",
      TG_API_HASH: env.TG_API_HASH ?? "<set me>",
    },
  };

  if (t === "claude-code" || t === "openclaw") {
    const snippet = {
      mcpServers: {
        "aide-hub": hub,
        "aide-telegram": tg,
      },
    };
    console.log(
      kleur.dim(
        `\n# Add to ~/.claude/settings.json (or merge into "mcpServers"):\n`,
      ),
    );
    console.log(JSON.stringify(snippet, null, 2));
    return 0;
  }

  if (t === "cursor") {
    console.log(
      kleur.dim(`\n# Add to Cursor Settings → MCP:\n`),
    );
    console.log(
      JSON.stringify(
        { "aide-hub": hub, "aide-telegram": tg },
        null,
        2,
      ),
    );
    return 0;
  }

  console.error(kleur.red(`Unknown target: ${t}`));
  console.error(`Supported: claude-code, openclaw, cursor`);
  return 1;
}
