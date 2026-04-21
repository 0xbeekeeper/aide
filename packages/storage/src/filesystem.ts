import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type {
  Triage,
  ReplyDraft,
  Task,
  StyleSample,
  DailyBrief,
  Style,
} from "@chief-of-staff/types";
import type { StorageAdapter, TriageQuery, TaskQuery } from "./adapter.js";
import { defaultConfigDir } from "./paths.js";

export interface FilesystemAdapterOptions {
  root?: string;
}

export class FilesystemAdapter implements StorageAdapter {
  private readonly root: string;

  constructor(opts: FilesystemAdapterOptions = {}) {
    this.root = opts.root ?? defaultConfigDir();
  }

  private dir(...parts: string[]): string {
    return join(this.root, ...parts);
  }

  private async ensure(path: string): Promise<void> {
    if (!existsSync(path)) {
      await mkdir(path, { recursive: true });
    }
  }

  private async writeJson<T>(path: string, data: T): Promise<void> {
    await writeFile(path, JSON.stringify(data, null, 2), "utf8");
  }

  private async readJson<T>(path: string): Promise<T | null> {
    if (!existsSync(path)) return null;
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw) as T;
  }

  private async listJson<T>(dir: string): Promise<T[]> {
    if (!existsSync(dir)) return [];
    const entries = await readdir(dir);
    const out: T[] = [];
    for (const entry of entries) {
      if (!entry.endsWith(".json")) continue;
      const item = await this.readJson<T>(join(dir, entry));
      if (item !== null) out.push(item);
    }
    return out;
  }

  async saveTriage(t: Triage): Promise<void> {
    const dir = this.dir("triage");
    await this.ensure(dir);
    await this.writeJson(join(dir, `${t.message_id}.json`), t);
  }

  async listTriage(q: TriageQuery = {}): Promise<Triage[]> {
    let items = await this.listJson<Triage>(this.dir("triage"));
    if (q.since) items = items.filter((t) => t.created_at >= q.since!);
    if (q.until) items = items.filter((t) => t.created_at <= q.until!);
    if (q.needs_reply !== undefined) {
      items = items.filter((t) => t.needs_reply === q.needs_reply);
    }
    if (q.chat_id) items = items.filter((t) => t.chat_id === q.chat_id);
    items.sort((a, b) => b.created_at.localeCompare(a.created_at));
    if (q.limit !== undefined) items = items.slice(0, q.limit);
    return items;
  }

  async getTriage(message_id: string): Promise<Triage | null> {
    return this.readJson<Triage>(this.dir("triage", `${message_id}.json`));
  }

  async saveDraft(d: ReplyDraft): Promise<void> {
    const dir = this.dir("drafts", d.message_id);
    await this.ensure(dir);
    await this.writeJson(join(dir, `${d.id}.json`), d);
  }

  async listDrafts(message_id: string): Promise<ReplyDraft[]> {
    const items = await this.listJson<ReplyDraft>(
      this.dir("drafts", message_id),
    );
    items.sort((a, b) => a.created_at.localeCompare(b.created_at));
    return items;
  }

  async markDraftSent(draft_id: string, sent_at: string): Promise<void> {
    const root = this.dir("drafts");
    if (!existsSync(root)) return;
    const messageDirs = await readdir(root);
    for (const md of messageDirs) {
      const path = join(root, md, `${draft_id}.json`);
      const existing = await this.readJson<ReplyDraft>(path);
      if (existing) {
        await this.writeJson(path, { ...existing, sent_at });
        return;
      }
    }
  }

  async saveTask(t: Task): Promise<void> {
    const dir = this.dir("tasks");
    await this.ensure(dir);
    await this.writeJson(join(dir, `${t.id}.json`), t);
  }

  async listTasks(q: TaskQuery = {}): Promise<Task[]> {
    let items = await this.listJson<Task>(this.dir("tasks"));
    if (q.status) items = items.filter((t) => t.status === q.status);
    items.sort((a, b) => b.created_at.localeCompare(a.created_at));
    if (q.limit !== undefined) items = items.slice(0, q.limit);
    return items;
  }

  async updateTaskStatus(task_id: string, status: Task["status"]): Promise<void> {
    const path = this.dir("tasks", `${task_id}.json`);
    const existing = await this.readJson<Task>(path);
    if (!existing) throw new Error(`task ${task_id} not found`);
    await this.writeJson(path, { ...existing, status });
  }

  async saveStyleSamples(samples: StyleSample[]): Promise<void> {
    const dir = this.dir("styles");
    await this.ensure(dir);
    for (const s of samples) {
      const styleDir = join(dir, s.style);
      await this.ensure(styleDir);
      await this.writeJson(join(styleDir, `${s.id}.json`), s);
    }
  }

  async listStyleSamples(style?: Style, limit?: number): Promise<StyleSample[]> {
    const dir = this.dir("styles");
    if (!existsSync(dir)) return [];
    const styles = style ? [style] : (await readdir(dir));
    const out: StyleSample[] = [];
    for (const s of styles) {
      const items = await this.listJson<StyleSample>(join(dir, s));
      out.push(...items);
    }
    out.sort((a, b) => b.extracted_at.localeCompare(a.extracted_at));
    return limit !== undefined ? out.slice(0, limit) : out;
  }

  async saveBrief(b: DailyBrief): Promise<void> {
    const dir = this.dir("briefs");
    await this.ensure(dir);
    await this.writeJson(join(dir, `${b.id}.json`), b);
    await writeFile(join(dir, `${b.id}.md`), b.markdown, "utf8");
  }

  async getLatestBrief(): Promise<DailyBrief | null> {
    const items = await this.listJson<DailyBrief>(this.dir("briefs"));
    if (items.length === 0) return null;
    items.sort((a, b) => b.generated_at.localeCompare(a.generated_at));
    return items[0] ?? null;
  }
}
