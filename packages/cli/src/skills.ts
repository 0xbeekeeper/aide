export interface SkillSpec {
  name: string;
  /** short user-facing alias: `cos run <alias>` */
  alias: string;
  /** prompt seed sent to the runtime to invoke this skill */
  prompt: string;
  description: string;
}

export const SKILLS: SkillSpec[] = [
  {
    name: "cos-triage",
    alias: "triage",
    description: "Triage unread Telegram messages into priority buckets.",
    prompt:
      "Use the cos-triage skill to triage my unread Telegram messages from the last 24 hours. Save results to the hub and print a summary.",
  },
  {
    name: "cos-reply",
    alias: "reply",
    description: "Draft 3 replies per pending message in my voice.",
    prompt:
      "Use the cos-reply skill to draft replies for every pending triage record in the hub. Save drafts but do NOT send.",
  },
  {
    name: "cos-task",
    alias: "task",
    description: "Extract actionable tasks from recent messages.",
    prompt:
      "Use the cos-task skill to extract tasks from recent triage records. Save to the hub, and sync to Notion if a Notion MCP is available.",
  },
  {
    name: "cos-brief",
    alias: "brief",
    description: "Generate the daily briefing markdown.",
    prompt:
      "Use the cos-brief skill to generate today's daily briefing from the hub. Save it and print it.",
  },
  {
    name: "cos-style-extract",
    alias: "extract-style",
    description: "Learn my writing style from Telegram sent history.",
    prompt:
      "Use the cos-style-extract skill to pull my own sent Telegram messages from the last 90 days, classify them into professional/push/casual, and save style samples to the hub.",
  },
];

export function findSkill(alias: string): SkillSpec | undefined {
  return SKILLS.find((s) => s.alias === alias || s.name === alias);
}
