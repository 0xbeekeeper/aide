import kleur from "kleur";
import { spawn } from "node:child_process";
import { readProfile, writeProfile, profilePath } from "../profile.js";

const DEFAULT_PROFILE = `# USER PROFILE

## Role
<your role — e.g. CTO at Acme, Engineering manager, Solo founder>

## Triage rubric
- Private DM to me → needs_reply: true, priority high+
- Group @-mention → needs_reply: true, priority high+
- Group related (my area/team, I'm active) → fyi, low/medium, no reply required
- Group unrelated → ignore

## Reply voice
- Decisive, not apologetic.
- Technical when the thread is technical.
- Short over long.
- Delegate by default in groups.

## Things I do NOT want in drafts
- Pleasantries / filler openers.
- Over-explaining context the sender already gave.
- Emojis / exclamation marks in professional drafts.
`;

export async function profileShowCommand(): Promise<number> {
  const p = await readProfile();
  if (!p) {
    console.log(
      kleur.dim(
        `No profile set. Path: ${profilePath()}\nRun 'aide profile edit' to create one.`,
      ),
    );
    return 0;
  }
  console.log(kleur.dim(`(from ${profilePath()})\n`));
  console.log(p);
  return 0;
}

export async function profileEditCommand(): Promise<number> {
  const existing = await readProfile();
  if (existing === null) {
    await writeProfile(DEFAULT_PROFILE);
  }
  const editor = process.env["EDITOR"] ?? "vim";
  return await new Promise((resolve) => {
    const child = spawn(editor, [profilePath()], { stdio: "inherit" });
    child.on("exit", (code) => resolve(code ?? 0));
    child.on("error", (err) => {
      console.error(kleur.red(`failed to launch editor (${editor}): ${err.message}`));
      console.error(
        kleur.dim(
          `open manually: ${profilePath()}\nor set $EDITOR to your preferred editor.`,
        ),
      );
      resolve(1);
    });
  });
}

export async function profileResetCommand(): Promise<number> {
  await writeProfile(DEFAULT_PROFILE);
  console.log(
    kleur.green(`✓ profile reset to template. Edit with: aide profile edit`),
  );
  return 0;
}
