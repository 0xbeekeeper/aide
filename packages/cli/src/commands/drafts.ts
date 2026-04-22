import kleur from "kleur";
import { FilesystemAdapter } from "@aide-os/storage";
import type { ReplyDraft, Style, Triage } from "@aide-os/types";
import { loadEnv, applyEnvToProcess } from "../env.js";

interface DraftGroup {
  message_id: string;
  chat_id: string;
  chat_title?: string;
  sender_name?: string;
  source_excerpt?: string;
  drafts: ReplyDraft[];
  triage?: Triage | null;
}

async function loadAllGroups(onlyPending: boolean): Promise<DraftGroup[]> {
  const storage = new FilesystemAdapter();
  const triages = await storage.listTriage({ needs_reply: true });
  const groups: DraftGroup[] = [];
  for (const t of triages) {
    const drafts = await storage.listDrafts(t.message_id);
    if (drafts.length === 0) continue;
    const pending = onlyPending ? drafts.filter((d) => !d.sent_at) : drafts;
    if (pending.length === 0) continue;
    const head = pending[0];
    const group: DraftGroup = {
      message_id: t.message_id,
      chat_id: t.chat_id,
      drafts: pending,
      triage: t,
    };
    if (head?.chat_title) group.chat_title = head.chat_title;
    if (head?.sender_name) group.sender_name = head.sender_name;
    const excerpt = head?.source_excerpt ?? t.summary;
    if (excerpt) group.source_excerpt = excerpt;
    groups.push(group);
  }
  return groups;
}

function styleColor(s: Style) {
  if (s === "professional") return kleur.blue;
  if (s === "push") return kleur.magenta;
  return kleur.yellow;
}

function conf(c: number): string {
  const n = c.toFixed(2);
  if (c >= 0.8) return kleur.green(n);
  if (c >= 0.5) return kleur.yellow(n);
  return kleur.red(n);
}

function renderGroup(g: DraftGroup, verbose: boolean): void {
  const title = g.chat_title ?? `chat ${g.chat_id}`;
  const sender = g.sender_name ?? "?";
  console.log(
    `\n${kleur.bold(title)}  ${kleur.dim("from")} ${kleur.cyan(sender)}  ${kleur.dim(`msg ${g.message_id}`)}`,
  );
  if (g.source_excerpt) {
    const lines = g.source_excerpt.split("\n");
    for (const l of lines) {
      console.log(kleur.dim(`  > ${l}`));
    }
  }
  if (g.triage) {
    console.log(
      kleur.dim(
        `  triage: ${g.triage.priority} / ${g.triage.intent} (conf ${g.triage.confidence.toFixed(2)})`,
      ),
    );
  }
  const sorted = [...g.drafts].sort((a, b) => b.confidence - a.confidence);
  for (const d of sorted) {
    const col = styleColor(d.style);
    console.log(
      `  ${col(d.style.toUpperCase().padEnd(13))} ${conf(d.confidence)}`,
    );
    const text = d.text.split("\n").map((l) => `    ${l}`).join("\n");
    console.log(text);
    if (verbose && d.reasoning) {
      console.log(kleur.dim(`    why: ${d.reasoning}`));
    }
    console.log(kleur.dim(`    id: ${d.id}`));
  }
}

export async function draftsListCommand(opts: {
  all?: boolean;
  verbose?: boolean;
}): Promise<number> {
  const env = await loadEnv();
  applyEnvToProcess(env);
  const groups = await loadAllGroups(!opts.all);
  if (groups.length === 0) {
    console.log(
      kleur.dim(
        opts.all
          ? "\nNo drafts saved yet.\n"
          : "\nNo pending drafts. (Use --all to include already-sent ones.)\n",
      ),
    );
    return 0;
  }

  console.log(
    kleur.bold(
      `\naide drafts — ${groups.length} message(s), ${groups.reduce((n, g) => n + g.drafts.length, 0)} draft(s)${opts.all ? "" : " (pending)"}`,
    ),
  );
  for (const g of groups) renderGroup(g, opts.verbose ?? false);
  console.log(
    kleur.dim(
      "\nTo mark one as sent after copy-pasting it into Telegram:\n  aide drafts mark-sent <draft-id>\n",
    ),
  );
  return 0;
}

export async function draftsShowCommand(
  messageId: string,
): Promise<number> {
  const env = await loadEnv();
  applyEnvToProcess(env);
  const storage = new FilesystemAdapter();
  const drafts = await storage.listDrafts(messageId);
  if (drafts.length === 0) {
    console.log(kleur.red(`No drafts for message ${messageId}.`));
    return 1;
  }
  const triage = await storage.getTriage(messageId);
  const head = drafts[0];
  const group: DraftGroup = {
    message_id: messageId,
    chat_id: triage?.chat_id ?? head?.chat_id ?? "",
    ...(head?.chat_title !== undefined ? { chat_title: head.chat_title } : {}),
    ...(head?.sender_name !== undefined ? { sender_name: head.sender_name } : {}),
    ...(head?.source_excerpt !== undefined
      ? { source_excerpt: head.source_excerpt }
      : triage?.summary !== undefined
      ? { source_excerpt: triage.summary }
      : {}),
    drafts,
    triage,
  };
  renderGroup(group, true);
  console.log();
  return 0;
}

export async function draftsMarkSentCommand(
  draftId: string,
): Promise<number> {
  const storage = new FilesystemAdapter();
  await storage.markDraftSent(draftId, new Date().toISOString());
  console.log(kleur.green(`✓ marked draft ${draftId} as sent.`));
  return 0;
}
