import kleur from "kleur";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname } from "node:path";
import { envFilePath } from "../paths.js";

type Lang = "en" | "zh";

function normalize(v: string): Lang | null {
  const s = v.toLowerCase();
  if (s === "zh" || s === "zh-cn" || s === "zh-hans" || s === "chinese" || s === "中文") {
    return "zh";
  }
  if (s === "en" || s === "english") return "en";
  return null;
}

export async function langCommand(value: string | undefined): Promise<number> {
  const path = envFilePath();
  const dir = dirname(path);
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });

  let raw = "";
  if (existsSync(path)) raw = await readFile(path, "utf8");

  if (!value) {
    const m = raw.match(/^AIDE_LANG=(.*)$/m);
    const current = m?.[1]?.replace(/^["']|["']$/g, "").trim() ?? "en";
    console.log(`current language: ${kleur.cyan(current)}`);
    console.log(kleur.dim("\nSet with:  aide lang zh  |  aide lang en"));
    return 0;
  }

  const lang = normalize(value);
  if (!lang) {
    console.error(kleur.red(`Unknown language: ${value}`));
    console.error("Supported: en, zh");
    return 1;
  }

  const lines = raw.split(/\r?\n/).filter((l) => !/^AIDE_LANG=/.test(l) && l.trim().length > 0);
  lines.push(`AIDE_LANG=${lang}`);
  await writeFile(path, lines.join("\n") + "\n", { encoding: "utf8", mode: 0o600 });

  console.log(kleur.green(`✓ language set to ${lang}`));
  console.log(
    kleur.dim(
      "\nThis takes effect on the next bot / aide run invocation.\n" +
        "Restart `aide-bot` (if running) for card labels to switch.",
    ),
  );
  return 0;
}
