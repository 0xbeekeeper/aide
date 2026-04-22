import kleur from "kleur";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { spawn } from "node:child_process";

const LABEL_TRIAGE = "com.aide.triage";
const LABEL_BRIEF = "com.aide.brief";

interface JobSpec {
  label: string;
  plistPath: string;
  command: string;
  /** StartInterval in seconds, OR StartCalendarInterval. */
  schedule:
    | { kind: "interval"; seconds: number }
    | { kind: "daily"; hour: number; minute: number };
}

function plistBody(spec: JobSpec, pathEnv: string): string {
  const scheduleBlock =
    spec.schedule.kind === "interval"
      ? `  <key>StartInterval</key>\n  <integer>${spec.schedule.seconds}</integer>`
      : `  <key>StartCalendarInterval</key>\n  <dict>\n    <key>Hour</key><integer>${spec.schedule.hour}</integer>\n    <key>Minute</key><integer>${spec.schedule.minute}</integer>\n  </dict>`;
  const logOut = join(homedir(), ".config", "aide", `launchd.${spec.label}.out.log`);
  const logErr = join(homedir(), ".config", "aide", `launchd.${spec.label}.err.log`);
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${spec.label}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>-lc</string>
    <string>${spec.command}</string>
  </array>
${scheduleBlock}
  <key>RunAtLoad</key>
  <false/>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>${pathEnv}</string>
  </dict>
  <key>StandardOutPath</key>
  <string>${logOut}</string>
  <key>StandardErrorPath</key>
  <string>${logErr}</string>
</dict>
</plist>
`;
}

async function writePlist(spec: JobSpec, pathEnv: string): Promise<void> {
  const dir = dirname(spec.plistPath);
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
  await writeFile(spec.plistPath, plistBody(spec, pathEnv), {
    encoding: "utf8",
    mode: 0o644,
  });
}

async function launchctl(args: string[]): Promise<number> {
  return await new Promise((resolve) => {
    const child = spawn("launchctl", args, { stdio: "inherit" });
    child.on("exit", (code) => resolve(code ?? 0));
    child.on("error", () => resolve(127));
  });
}

function specs(): JobSpec[] {
  const plistDir = join(homedir(), "Library", "LaunchAgents");
  return [
    {
      label: LABEL_TRIAGE,
      plistPath: join(plistDir, `${LABEL_TRIAGE}.plist`),
      command: "aide run triage && aide-bot push-pending",
      schedule: { kind: "interval", seconds: 900 },
    },
    {
      label: LABEL_BRIEF,
      plistPath: join(plistDir, `${LABEL_BRIEF}.plist`),
      command: "aide run brief",
      schedule: { kind: "daily", hour: 8, minute: 30 },
    },
  ];
}

export async function installLaunchdCommand(): Promise<number> {
  if (process.platform !== "darwin") {
    console.error(
      kleur.red("launchd is macOS-only. Use cron / systemd on other platforms."),
    );
    return 1;
  }
  const pathEnv = process.env["PATH"] ?? "/usr/local/bin:/usr/bin:/bin";
  const jobs = specs();
  for (const job of jobs) {
    await writePlist(job, pathEnv);
    console.log(kleur.dim(`wrote ${job.plistPath}`));
    // unload first (ignore errors) then load
    await launchctl(["unload", "-w", job.plistPath]);
    const code = await launchctl(["load", "-w", job.plistPath]);
    if (code !== 0) {
      console.error(
        kleur.red(`launchctl load failed for ${job.label} (exit ${code}).`),
      );
      return code;
    }
    if (job.schedule.kind === "interval") {
      console.log(
        kleur.green(
          `✓ ${job.label} loaded — every ${job.schedule.seconds / 60} min`,
        ),
      );
    } else {
      const hh = String(job.schedule.hour).padStart(2, "0");
      const mm = String(job.schedule.minute).padStart(2, "0");
      console.log(kleur.green(`✓ ${job.label} loaded — daily at ${hh}:${mm}`));
    }
  }
  console.log(
    kleur.dim(
      "\nLogs land at ~/.config/aide/launchd.*.out.log (and .err.log).\n" +
        "Uninstall with: aide uninstall-launchd",
    ),
  );
  return 0;
}

export async function uninstallLaunchdCommand(): Promise<number> {
  if (process.platform !== "darwin") return 0;
  const jobs = specs();
  for (const job of jobs) {
    if (existsSync(job.plistPath)) {
      await launchctl(["unload", "-w", job.plistPath]);
      await unlink(job.plistPath);
      console.log(kleur.green(`✓ removed ${job.label}`));
    } else {
      console.log(kleur.dim(`(not installed) ${job.label}`));
    }
  }
  return 0;
}
