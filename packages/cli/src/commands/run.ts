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
import { readState, writeState } from "../state.js";

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
  let prompt = await enrichWithProfile(skill.prompt);

  // For triage specifically, inject the watermark so we only scan new messages
  // since the last successful run (or midnight, whichever is later).
  if (skill.name === "aide-triage") {
    const state = await readState();
    if (state.last_triage_at) {
      prompt =
        `Incremental scan: the last triage run finished at ${state.last_triage_at}. ` +
        `Pass since = max(start of today local, ${state.last_triage_at}) to list_unread. ` +
        `Also pass skip_if_replied=true so messages you've already replied to are dropped.\n\n` +
        prompt;
    } else {
      prompt =
        `First triage run on this machine. Scan since start of today (local 00:00). ` +
        `Pass skip_if_replied=true so messages you've already replied to are dropped.\n\n` +
        prompt;
    }
  }

  console.log(kleur.dim(`▶ running ${skill.name} via ${runtime}`));

  if (runtime === "claude-code") {
    const code = await runClaudeCode(prompt);
    if (code === 0 && skill.name === "aide-triage") {
      const state = await readState();
      state.last_triage_at = new Date().toISOString();
      await writeState(state);
    }
    return code;
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
