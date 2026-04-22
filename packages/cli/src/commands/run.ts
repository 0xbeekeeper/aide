import kleur from "kleur";
import { loadEnv, applyEnvToProcess } from "../env.js";
import {
  detectRuntime,
  runClaudeCode,
  manualInstructions,
  type Runtime,
} from "../runtime.js";
import { SKILLS, findSkill } from "../skills.js";
import { enrichWithProfile } from "../profile.js";

export interface RunOptions {
  runtime?: Runtime;
}

export async function runCommand(
  alias: string | undefined,
  opts: RunOptions,
): Promise<number> {
  if (!alias) {
    console.log(kleur.bold("Available skills:\n"));
    for (const s of SKILLS) {
      console.log(`  ${kleur.cyan(s.alias.padEnd(16))} ${s.description}`);
    }
    console.log(`\nUsage: ${kleur.dim("aide run <alias>")}`);
    return 0;
  }

  const skill = findSkill(alias);
  if (!skill) {
    console.error(kleur.red(`Unknown skill: ${alias}`));
    console.error(
      `Run ${kleur.cyan("aide run")} with no argument to see available skills.`,
    );
    return 1;
  }

  const env = await loadEnv();
  applyEnvToProcess(env);

  const runtime = opts.runtime ?? detectRuntime();
  const prompt = await enrichWithProfile(skill.prompt);

  console.log(kleur.dim(`▶ running ${skill.name} via ${runtime}`));

  if (runtime === "claude-code") {
    return await runClaudeCode(prompt);
  }
  if (runtime === "openclaw") {
    console.error(
      kleur.yellow(
        "openclaw runtime adapter not yet implemented — falling back to manual instructions.",
      ),
    );
    console.log(manualInstructions(skill.name, prompt));
    return 0;
  }

  console.log(manualInstructions(skill.name, prompt));
  return 0;
}
