import kleur from "kleur";
import { FilesystemAdapter } from "@chief-of-staff/storage";

export async function statusCommand(): Promise<number> {
  const storage = new FilesystemAdapter();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [triage, tasks, brief] = await Promise.all([
    storage.listTriage({ since }),
    storage.listTasks({ status: "open" }),
    storage.getLatestBrief(),
  ]);

  const pending = triage.filter((t) => t.needs_reply);

  console.log(kleur.bold("\ncos status — last 24h\n"));
  console.log(`  ${kleur.cyan("triage:")}   ${triage.length} records (${pending.length} need reply)`);
  console.log(`  ${kleur.cyan("tasks:")}    ${tasks.length} open`);
  console.log(
    `  ${kleur.cyan("brief:")}    ${brief ? `last at ${brief.generated_at}` : "none yet"}`,
  );
  console.log();
  return 0;
}
