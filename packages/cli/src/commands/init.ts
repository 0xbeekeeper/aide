import kleur from "kleur";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { loadEnv, saveEnv } from "../env.js";
import { configDir, sessionFilePath } from "../paths.js";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

async function prompt(q: string, secret = false): Promise<string> {
  const readline = await import("node:readline");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    if (secret) {
      process.stdout.write(q);
      const stdin = process.stdin;
      let buf = "";
      const onData = (d: Buffer) => {
        const s = d.toString("utf8");
        if (s.includes("\n") || s.includes("\r")) {
          stdin.setRawMode(false);
          stdin.removeListener("data", onData);
          stdin.pause();
          rl.close();
          process.stdout.write("\n");
          resolve(buf);
          return;
        }
        buf += s;
      };
      stdin.setRawMode(true);
      stdin.resume();
      stdin.on("data", onData);
    } else {
      rl.question(q, (a) => {
        rl.close();
        resolve(a);
      });
    }
  });
}

export async function initCommand(): Promise<number> {
  console.log(kleur.bold("\n▶ aide init\n"));
  console.log(
    "This wizard configures Telegram credentials and signs you in.\n" +
      `Config will be stored at: ${kleur.cyan(configDir())}\n`,
  );

  const existing = await loadEnv();

  const apiIdDefault = existing.TG_API_ID ?? "";
  const apiHashDefault = existing.TG_API_HASH ?? "";

  console.log(
    kleur.dim(
      "Get API_ID and API_HASH from https://my.telegram.org (one-time, free)\n",
    ),
  );

  const apiId =
    (await prompt(`TG_API_ID${apiIdDefault ? ` [${apiIdDefault}]` : ""}: `)).trim() ||
    apiIdDefault;
  const apiHash =
    (await prompt(`TG_API_HASH${apiHashDefault ? ` [${apiHashDefault.slice(0, 6)}…]` : ""}: `)).trim() ||
    apiHashDefault;

  if (!apiId || !apiHash) {
    console.error(kleur.red("\nBoth TG_API_ID and TG_API_HASH are required."));
    return 1;
  }

  await saveEnv({ ...existing, TG_API_ID: apiId, TG_API_HASH: apiHash });
  console.log(kleur.green("✓ saved credentials"));

  if (existsSync(sessionFilePath())) {
    const replace = (
      await prompt(`\nSession already exists. Re-login? [y/N]: `)
    ).trim().toLowerCase();
    if (replace !== "y") {
      console.log(kleur.dim("keeping existing session."));
      return 0;
    }
  }

  console.log(kleur.bold("\n▶ Telegram login\n"));
  const loginBin = require.resolve(
    "@aide-os/mcp-telegram/dist/login.js",
  );
  const code = await new Promise<number>((resolve) => {
    const child = spawn(process.execPath, [loginBin], {
      stdio: "inherit",
      env: { ...process.env, TG_API_ID: apiId, TG_API_HASH: apiHash },
    });
    child.on("exit", (c) => resolve(c ?? 0));
  });

  if (code !== 0) {
    console.error(kleur.red("login failed."));
    return code;
  }

  console.log(
    kleur.green("\n✓ setup complete. ") +
      `Try ${kleur.cyan("aide doctor")} then ${kleur.cyan("aide run triage")}.\n`,
  );
  return 0;
}
