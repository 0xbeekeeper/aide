import kleur from "kleur";
import { existsSync } from "node:fs";
import { loadEnv } from "../env.js";
import { configDir, sessionFilePath } from "../paths.js";
import { detectRuntime } from "../runtime.js";

interface Check {
  name: string;
  status: "ok" | "warn" | "fail";
  detail: string;
}

export async function doctorCommand(): Promise<number> {
  const checks: Check[] = [];

  const env = await loadEnv();

  checks.push({
    name: "config dir",
    status: existsSync(configDir()) ? "ok" : "warn",
    detail: configDir(),
  });

  checks.push({
    name: "TG_API_ID",
    status: env.TG_API_ID ? "ok" : "fail",
    detail: env.TG_API_ID ? "set" : "missing — get one at https://my.telegram.org",
  });

  checks.push({
    name: "TG_API_HASH",
    status: env.TG_API_HASH ? "ok" : "fail",
    detail: env.TG_API_HASH ? "set" : "missing — get one at https://my.telegram.org",
  });

  checks.push({
    name: "telegram session",
    status: existsSync(sessionFilePath()) ? "ok" : "fail",
    detail: existsSync(sessionFilePath())
      ? sessionFilePath()
      : "missing — run `aide init` to sign in",
  });

  const runtime = detectRuntime();
  checks.push({
    name: "agent runtime",
    status: runtime === "manual" ? "warn" : "ok",
    detail:
      runtime === "manual"
        ? "no claude / openclaw binary found on PATH"
        : runtime,
  });

  const emoji = (s: Check["status"]) =>
    s === "ok" ? kleur.green("✓") : s === "warn" ? kleur.yellow("!") : kleur.red("✗");

  console.log(kleur.bold("\naide doctor\n"));
  for (const c of checks) {
    console.log(`  ${emoji(c.status)} ${c.name.padEnd(20)} ${kleur.dim(c.detail)}`);
  }
  console.log();

  const anyFail = checks.some((c) => c.status === "fail");
  return anyFail ? 1 : 0;
}
